"""Media upload and streaming router — with SEC-04 (path traversal) and SEC-05 (file validation) fixes.

Endpoints:
  POST /upload          — single-shot upload (existing)
  POST /chunk           — upload one chunk of a multi-part upload
  POST /assemble        — assemble chunks into final file
  GET  /proxy/{id}      — return proxy URL for a project
  GET  /stream/{id}     — range-aware media streaming (existing)
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse, StreamingResponse
import logging
import os
import re
import uuid
import shutil
import mimetypes
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from bson import ObjectId

from app.db.database import get_database
from app.core.security import get_current_active_user, require_credits
from app.core.config import settings
from app.services.proxy_service import generate_proxy

router = APIRouter(prefix="/media", tags=["Media"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"
CHUNK_DIR = "uploads/chunks"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHUNK_DIR, exist_ok=True)


class AssembleRequest(BaseModel):
    project_id: str
    total_chunks: int
    original_filename: Optional[str] = "upload"

# ── SEC-05: MIME type allowlist ───────────────────────────────────────────────
ALLOWED_MIME_TYPES = {
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    "video/webm", "video/ogg", "video/3gpp", "video/3gpp2",
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
    "audio/x-wav", "audio/aac", "audio/flac",
}

# Magic bytes (file signatures) for allowed types — checked on first 12 bytes
MAGIC_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\x00\x00\x00", "video/mp4"),          # MP4/MOV (ftyp box)
    (b"ftyp", "video/mp4"),                   # MP4 ftyp
    (b"\x1a\x45\xdf\xa3", "video/webm"),      # WebM / MKV
    (b"RIFF", "audio/wav"),                   # WAV
    (b"\xff\xfb", "audio/mpeg"),              # MP3
    (b"\xff\xf3", "audio/mpeg"),
    (b"\xff\xf2", "audio/mpeg"),
    (b"ID3", "audio/mpeg"),                   # MP3 with ID3 tag
    (b"OggS", "audio/ogg"),                   # OGG
    (b"fLaC", "audio/flac"),                  # FLAC
]

MAX_FILE_SIZE = settings.max_upload_size_bytes  # default 2 GB


def _safe_filename(original: str) -> str:
    """SEC-04: Sanitize a user-supplied filename to prevent path traversal.

    Steps:
    1. Strip to basename only (eliminates directory components).
    2. Replace any non-alphanumeric chars (except . _ -) with underscores.
    3. Prefix with a UUID so the final storage name is unpredictable.
    """
    basename = os.path.basename(original)
    safe = re.sub(r"[^a-zA-Z0-9._\-]", "_", basename)
    if not safe or safe.startswith("."):
        safe = "upload"
    return f"{uuid.uuid4().hex}_{safe}"


def _validate_magic_bytes(header: bytes, content_type: str) -> bool:
    """SEC-05: Check that the first 12 bytes match known safe signatures."""
    # Allow if mime type matches a known safe signature
    for sig, _ in MAGIC_SIGNATURES:
        if header.startswith(sig):
            return True
    # MP4/MOV: ftyp box appears at offset 4
    if len(header) >= 8 and header[4:8] == b"ftyp":
        return True
    # If no signature matched, reject
    return False


def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _realpath_inside(path: str, parent: str) -> bool:
    parent_real = os.path.realpath(parent)
    path_real = os.path.realpath(path)
    return path_real == parent_real or path_real.startswith(parent_real + os.sep)


def _variant_key(target_ratio: str, reframe_mode: Optional[str]) -> str:
    mode = (reframe_mode or "person_center").strip().lower()
    suffix = "fit_blur" if mode == "fit_blur" else "person_crop"
    return f"{target_ratio.replace(':', 'x')}_{suffix}"


def _resolve_cropped_variant_path(media: dict, target_ratio: str, reframe_mode: Optional[str] = None) -> str | None:
    variants = media.get("cropped_variants")
    if isinstance(variants, dict):
        variant = variants.get(_variant_key(target_ratio, reframe_mode))
        if isinstance(variant, dict):
            path = str(variant.get("path") or "")
            if path and os.path.exists(path):
                return path

        # Backward compatibility for older generated crop variants keyed only by ratio.
        if (reframe_mode or "person_center") != "fit_blur":
            variant = variants.get(target_ratio)
            if isinstance(variant, dict):
                path = str(variant.get("path") or "")
                if path and os.path.exists(path):
                    return path

    cropped_path = str(media.get("cropped_path") or "")
    cropped_ratio = str(media.get("target_ratio") or "")
    if cropped_path and cropped_ratio == target_ratio and os.path.exists(cropped_path):
        return cropped_path
    return None


# ─── Background helper ───────────────────────────────────────────────────────

async def _generate_and_store_proxy(file_path: str, project_id: str, db) -> None:
    """Fire-and-forget: generate proxy and persist proxy_path to media_files."""
    proxy_path = await generate_proxy(file_path, project_id)
    if proxy_path:
        await db.media_files.update_one(
            {"project_id": project_id},
            {"$set": {"proxy_path": proxy_path}},
        )


# ─── Single-shot upload ────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_media(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_credits(1)),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Verify project belongs to user
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # ── SEC-05: MIME type validation ──────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: '{content_type}'. Allowed: video and audio files only.",
        )

    # ── SEC-05: Read header for magic-byte validation + streaming size check ──
    header = await file.read(12)
    if len(header) < 4 or not _validate_magic_bytes(header, content_type):
        raise HTTPException(
            status_code=415,
            detail="File content does not match a valid video/audio format.",
        )

    # ── SEC-04: Sanitize filename to prevent path traversal ───────────────────
    safe_name = _safe_filename(file.filename or "upload")
    file_path = os.path.join(UPLOAD_DIR, f"{project_id}_{safe_name}")

    # Validate the resolved path stays inside UPLOAD_DIR
    if not _realpath_inside(file_path, UPLOAD_DIR):
        raise HTTPException(status_code=400, detail="Invalid file path")

    # ── SEC-05: Stream to disk with size enforcement ──────────────────────────
    bytes_written = len(header)
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(header)  # write the already-read header first
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_FILE_SIZE:
                    # Clean up partial file
                    buffer.close()
                    try:
                        os.unlink(file_path)
                    except OSError:
                        pass
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024**3)} GB.",
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        try:
            os.unlink(file_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    file_size = bytes_written

    media_data = {
        "project_id": project_id,
        "original_filename": file.filename,
        "safe_filename": safe_name,
        "size_bytes": file_size,
        "format": content_type,
        "local_path": file_path,
        "created_at": datetime.now(timezone.utc),
    }

    media_result = await db.media_files.insert_one(media_data)

    # Update project with media url and set status to ready
    await db.projects.update_one(
        {"_id": obj_id},
        {"$set": {"media_url": file_path, "status": "ready", "updated_at": datetime.now(timezone.utc)}},
    )

    # Kick off proxy generation in background (non-blocking)
    background_tasks.add_task(_generate_and_store_proxy, file_path, project_id, db)

    return {
        "message": "Upload successful",
        "media_id": str(media_result.inserted_id),
        "file_path": file_path,
        "size_bytes": file_size,
        "proxy_status": "generating",
    }


@router.get("/stream/{project_id}")
async def stream_media(
    project_id: str,
    request: Request,
    target_ratio: Optional[str] = Query(default=None),
    reframe_mode: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Stream media file for HTML5 video playback with Range header support."""
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    media = await db.media_files.find_one({"project_id": project_id})
    if not media:
        raise HTTPException(status_code=404, detail="Media file not found")

    original_path = media.get("local_path") or project.get("media_url")
    if not original_path or not os.path.exists(original_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    file_path = original_path
    if target_ratio:
        resolved = _resolve_cropped_variant_path(media, target_ratio, reframe_mode)
        if resolved:
            file_path = resolved
        elif reframe_mode in {"person_center", "fit_blur"}:
            try:
                from app.services.crop_service import crop_video

                base, _ext = os.path.splitext(original_path)
                variant_key = _variant_key(target_ratio, reframe_mode)
                generated_path = f"{base}_reframed_{variant_key}.mp4"
                crop_fit_mode = "fit_blur_bg" if reframe_mode == "fit_blur" else "person_crop"
                try:
                    result = await crop_video(original_path, generated_path, target_ratio, fit_mode=crop_fit_mode)  # type: ignore[arg-type]
                except Exception as first_exc:
                    logger.warning(
                        "media stream primary reframe failed project=%s ratio=%s; retrying center fallback: %s",
                        project_id,
                        target_ratio,
                        first_exc,
                    )
                    result = await crop_video(original_path, generated_path, target_ratio, subject_x_pct=0.5, fit_mode=crop_fit_mode)  # type: ignore[arg-type]
                now = datetime.now(timezone.utc)
                await db.media_files.update_one(
                    {"_id": media["_id"]},
                    {"$set": {
                        "cropped_path": generated_path,
                        "target_ratio": target_ratio,
                        f"cropped_variants.{variant_key}": {
                            "path": generated_path,
                            "target_ratio": target_ratio,
                            "reframe_mode": reframe_mode,
                            "method": result.get("method") or "subject_crop",
                            "subject_x_pct": result.get("subject_x_pct"),
                            "created_at": now,
                        },
                        "updated_at": now,
                    }},
                )
                file_path = generated_path
            except Exception as exc:
                # Graceful fallback to original stream.
                logger.warning("media stream reframe failed project=%s: %s", project_id, exc)

    file_size = os.path.getsize(file_path)
    content_type = mimetypes.guess_type(file_path)[0] or "video/mp4"

    # Handle Range header for seeking
    range_header = request.headers.get("range")
    if range_header:
        range_val = range_header.strip().replace("bytes=", "")
        range_parts = range_val.split("-")
        start = int(range_parts[0])
        end = int(range_parts[1]) if range_parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(8192, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_file(),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
                "Content-Type": content_type,
            },
        )

    # Full file response (no Range)
    return FileResponse(
        file_path,
        media_type=content_type,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )


# ─── Chunked upload ───────────────────────────────────────────────────────────

@router.post("/chunk")
async def upload_chunk(
    project_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Receive a single 5 MB chunk of a multi-part upload.

    The client should POST chunks sequentially (or in parallel) with
    ``chunk_index`` from 0 to ``total_chunks - 1``, then call ``/assemble``.
    """
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if total_chunks <= 0:
        raise HTTPException(status_code=400, detail="total_chunks must be greater than zero")
    if chunk_index < 0 or chunk_index >= total_chunks:
        raise HTTPException(status_code=400, detail="chunk_index is out of range")

    chunk_project_dir = os.path.join(CHUNK_DIR, project_id)
    if not _realpath_inside(chunk_project_dir, CHUNK_DIR):
        raise HTTPException(status_code=400, detail="Invalid chunk path")
    os.makedirs(chunk_project_dir, exist_ok=True)

    chunk_path = os.path.join(chunk_project_dir, f"{chunk_index:05d}.bin")
    if not _realpath_inside(chunk_path, chunk_project_dir):
        raise HTTPException(status_code=400, detail="Invalid chunk path")

    chunk_data = await chunk.read()
    existing_size = 0
    for name in os.listdir(chunk_project_dir):
        if not name.endswith(".bin") or name == f"{chunk_index:05d}.bin":
            continue
        existing_path = os.path.join(chunk_project_dir, name)
        if _realpath_inside(existing_path, chunk_project_dir):
            existing_size += os.path.getsize(existing_path)

    if existing_size + len(chunk_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024**3)} GB.",
        )

    try:
        with open(chunk_path, "wb") as f:
            f.write(chunk_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write chunk: {e}")

    return {
        "chunk_index": chunk_index,
        "size_bytes": len(chunk_data),
        "total_chunks": total_chunks,
        "status": "received",
    }


@router.post("/assemble")
async def assemble_chunks(
    body: AssembleRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_credits(1)),
    db=Depends(get_database),
):
    """Assemble previously uploaded chunks into a single media file.

    After assembling, fires proxy generation as a background task.
    """
    user_id = current_user.get("uid")
    project_id = body.project_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if body.total_chunks <= 0:
        raise HTTPException(status_code=400, detail="total_chunks must be greater than zero")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chunk_project_dir = os.path.join(CHUNK_DIR, project_id)
    if not _realpath_inside(chunk_project_dir, CHUNK_DIR):
        raise HTTPException(status_code=400, detail="Invalid chunk path")
    if not os.path.isdir(chunk_project_dir):
        raise HTTPException(status_code=400, detail="No chunks found for this project")

    expected_files = {f"{i:05d}.bin" for i in range(body.total_chunks)}
    all_files = set(os.listdir(chunk_project_dir))
    chunk_files = sorted(f for f in all_files if f.endswith(".bin"))
    unexpected_files = all_files - expected_files
    missing_files = expected_files - set(chunk_files)
    if unexpected_files or missing_files:
        raise HTTPException(
            status_code=400,
            detail="Chunk set is incomplete or contains unexpected files",
        )
    if len(chunk_files) != body.total_chunks:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {body.total_chunks} chunks, found {len(chunk_files)}",
        )

    safe_name = _safe_filename(body.original_filename or "upload")
    final_path = os.path.join(UPLOAD_DIR, f"{project_id}_{safe_name}")
    if not _realpath_inside(final_path, UPLOAD_DIR):
        raise HTTPException(status_code=400, detail="Invalid file path")

    total_size = 0
    for chunk_file in chunk_files:
        chunk_path = os.path.join(chunk_project_dir, chunk_file)
        if not _realpath_inside(chunk_path, chunk_project_dir):
            raise HTTPException(status_code=400, detail="Invalid chunk path")
        total_size += os.path.getsize(chunk_path)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE // (1024**3)} GB.",
            )

    # Assemble
    try:
        with open(final_path, "wb") as out:
            for chunk_file in chunk_files:
                chunk_path = os.path.join(chunk_project_dir, chunk_file)
                if not _realpath_inside(chunk_path, chunk_project_dir):
                    raise HTTPException(status_code=400, detail="Invalid chunk path")
                with open(chunk_path, "rb") as chunk_fp:
                    shutil.copyfileobj(chunk_fp, out)
    except HTTPException:
        try:
            os.unlink(final_path)
        except OSError:
            pass
        raise
    except Exception as e:
        try:
            os.unlink(final_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"Assembly failed: {e}")

    # Clean up chunk directory
    shutil.rmtree(chunk_project_dir, ignore_errors=True)

    file_size = os.path.getsize(final_path)

    # Upsert media_files record
    media_data = {
        "project_id": project_id,
        "original_filename": body.original_filename,
        "safe_filename": safe_name,
        "size_bytes": file_size,
        "format": "video/mp4",
        "local_path": final_path,
        "created_at": datetime.now(timezone.utc),
    }
    await db.media_files.replace_one(
        {"project_id": project_id},
        media_data,
        upsert=True,
    )
    await db.projects.update_one(
        {"_id": obj_id},
        {"$set": {"media_url": final_path, "status": "ready", "updated_at": datetime.now(timezone.utc)}},
    )

    background_tasks.add_task(_generate_and_store_proxy, final_path, project_id, db)

    return {
        "message": "Assembly complete",
        "file_path": final_path,
        "size_bytes": file_size,
        "proxy_status": "generating",
    }


@router.get("/proxy/{project_id}")
async def get_proxy_url(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Return proxy file path and streaming URL for a project (if proxy is ready)."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    media = await db.media_files.find_one({"project_id": project_id})
    if not media:
        raise HTTPException(status_code=404, detail="No media found for this project")

    proxy_path = media.get("proxy_path")
    proxy_ready = bool(proxy_path and os.path.exists(proxy_path))

    return {
        "proxy_ready": proxy_ready,
        "proxy_path": proxy_path if proxy_ready else None,
        "original_path": media.get("local_path"),
    }

