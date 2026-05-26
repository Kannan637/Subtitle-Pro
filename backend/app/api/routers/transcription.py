"""Transcription router — async background job + SSE progress stream.

POST /{project_id}         → queues a background transcription job, returns 202 immediately
GET  /{project_id}/stream  → SSE stream: sends progress/status events until complete or error
GET  /{project_id}         → poll job status + full cue result
"""
import asyncio
import json
import logging
import math
import os
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse, JSONResponse

from app.db.database import get_database
from app.core.security import get_current_active_user, get_current_active_user_from_request, require_credits
from app.services.groq_service import transcribe_audio
from app.services.subtitle_service import segments_to_cues
from app.services.credit_service import deduct_credits
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transcription", tags=["Transcription"])


def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


# ─── Background task ─────────────────────────────────────────────────────────

async def _run_transcription_job(
    job_id: str,
    project_id: str,
    obj_id: ObjectId,
    user_id: str,
    project_name: str,
    file_path: str,
    language: str,
    model: str,
    db,
) -> None:
    """Run the actual transcription in a background task with progress tracking."""

    async def _update_progress(pct: int, status_str: str = "processing") -> None:
        await db.transcription_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"progress_pct": pct, "status": status_str}},
        )

    def _classify_error_message(raw_error: Exception) -> tuple[str, str]:
        text = str(raw_error or "").strip()
        low = text.lower()
        if "groq_api_key is not set" in low:
            return (
                "AI transcription is not configured for this workspace.",
                "missing_groq_api_key",
            )
        if "exceeds groq's 25mb limit" in low:
            return (
                "Audio is still too large for transcription after compression. Trim or lower source quality and retry.",
                "audio_too_large_for_provider",
            )
        if "no such file or directory" in low:
            return (
                "Source media file was not found during transcription.",
                "media_file_missing",
            )
        if "ffmpeg" in low and ("not found" in low or "is not recognized" in low):
            return (
                "Video processing is not available on this workspace.",
                "missing_ffmpeg",
            )
        if text:
            return (text, "transcription_runtime_error")
        return ("Transcription failed due to an unexpected runtime error.", "transcription_runtime_error")

    try:
        await _update_progress(5, "processing")

        # ── Transcribe (runs in thread pool to avoid blocking the event loop) ──
        result = await asyncio.to_thread(
            transcribe_audio,
            file_path=file_path,
            language=language if language != "auto" else None,
            model=model,
        )
        await _update_progress(60)

        duration_sec = result.get("duration", 0)
        detected_lang = result.get("language", "en")

        # ── Create subtitle track ──────────────────────────────────────────────
        track = {
            "project_id": project_id,
            "user_id": user_id,
            "language_code": detected_lang,
            "is_original": True,
            "created_by": "ai",
            "version": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        track_result = await db.subtitle_tracks.insert_one(track)
        track_id = str(track_result.inserted_id)
        await _update_progress(75)

        # ── Insert cues ───────────────────────────────────────────────────────
        cues = segments_to_cues(result.get("segments", []), track_id=track_id)
        if cues:
            for cue in cues:
                cue["created_at"] = datetime.now(timezone.utc)
                cue["updated_at"] = datetime.now(timezone.utc)
            await db.subtitle_cues.insert_many(cues)
        await _update_progress(90)

        # ── Deduct credits ────────────────────────────────────────────────────
        credits_to_deduct = max(1, math.ceil(duration_sec / 60))
        try:
            await deduct_credits(
                db, user_id, credits_to_deduct,
                reference=job_id,
                note=f"Transcription: {project_name}",
            )
        except ValueError:
            logger.warning(f"Credit deduction failed for user {user_id}")

        # ── Finalise ──────────────────────────────────────────────────────────
        await db.transcription_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "complete",
                "progress_pct": 100,
                "detected_lang": detected_lang,
                "track_id": track_id,
                "cue_count": len(cues),
                "credits_used": credits_to_deduct,
                "duration_sec": int(duration_sec),
                "completed_at": datetime.now(timezone.utc),
            }},
        )
        await db.projects.update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "ready",
                "duration_sec": int(duration_sec),
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    except Exception as e:
        logger.error(f"Background transcription failed for project {project_id}: {e}", exc_info=True)
        user_error, error_code = _classify_error_message(e)
        await db.transcription_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "error",
                "error_message": user_error,
                "error_code": error_code,
                "debug_error": str(e),
                "progress_pct": 0,
                "completed_at": datetime.now(timezone.utc),
            }},
        )
        await db.projects.update_one(
            {"_id": obj_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc)}},
        )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{project_id}", status_code=202)
@limiter.limit("5/minute")
async def start_transcription(
    request: Request,
    project_id: str,
    background_tasks: BackgroundTasks,
    language: str = "auto",
    model: str = "whisper-large-v3-turbo",
    current_user: dict = Depends(require_credits(1)),
    db=Depends(get_database),
):
    """Queue a transcription job. Returns 202 immediately; poll /stream for progress."""
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
        raise HTTPException(status_code=400, detail="No media file uploaded for this project")

    file_path = media.get("local_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="Media file path not found")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Uploaded media file is missing on server storage")

    # Mark project as processing
    await db.projects.update_one(
        {"_id": obj_id},
        {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}},
    )

    # Create job record (status = queued)
    job = {
        "project_id": project_id,
        "status": "queued",
        "progress_pct": 0,
        "model_used": model,
        "source_lang": language if language != "auto" else None,
        "started_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    job_result = await db.transcription_jobs.insert_one(job)
    job_id = str(job_result.inserted_id)

    background_tasks.add_task(
        _run_transcription_job,
        job_id=job_id,
        project_id=project_id,
        obj_id=obj_id,
        user_id=user_id,
        project_name=project.get("name", "Untitled"),
        file_path=file_path,
        language=language,
        model=model,
        db=db,
    )

    return JSONResponse(
        status_code=202,
        content={"status": "queued", "job_id": job_id, "message": "Transcription started. Subscribe to /stream for progress."},
    )


@router.get("/{project_id}/stream")
async def stream_transcription_progress(
    request: Request,
    project_id: str,
    current_user: dict = Depends(get_current_active_user_from_request),
    db=Depends(get_database),
):
    """SSE stream for transcription progress.

    Yields ``data: {...}\\n\\n`` events every second until status is ``complete`` or ``error``.
    """
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    async def _event_generator():
        # Long uploads can spend several minutes in provider transcription.
        # Keep the SSE stream open long enough for production-length clips,
        # while the frontend can still reconnect/poll if a proxy drops it.
        max_polls = 3600  # 60 minutes max
        polls = 0
        yield "retry: 3000\n\n"
        while polls < max_polls:
            if await request.is_disconnected():
                break

            job = await db.transcription_jobs.find_one(
                {"project_id": project_id},
                sort=[("created_at", -1)],  # latest job
            )
            if not job:
                payload = json.dumps({"status": "not_found", "progress": 0})
                yield f"data: {payload}\n\n"
                await asyncio.sleep(1)
                polls += 1
                continue

            job_status = job.get("status", "unknown")
            progress = job.get("progress_pct", 0)

            payload = json.dumps({
                "status": job_status,
                "progress": progress,
                "job_id": str(job["_id"]),
                "error_message": job.get("error_message"),
                "error_code": job.get("error_code"),
            })
            yield f"data: {payload}\n\n"

            if job_status in ("complete", "error"):
                break

            await asyncio.sleep(1)
            polls += 1

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/{project_id}")
async def get_transcription(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Get transcription status and full cue result for a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job = await db.transcription_jobs.find_one(
        {"project_id": project_id},
        sort=[("created_at", -1)],
    )
    if not job:
        return {"status": "none", "message": "No transcription found for this project"}

    track = await db.subtitle_tracks.find_one({"project_id": project_id, "is_original": True})

    cues: list[dict] = []
    if track:
        cursor = db.subtitle_cues.find({"track_id": str(track["_id"])}).sort("sequence", 1)
        async for cue in cursor:
            cues.append(fix_id(cue))

    return {
        "status": job.get("status", "unknown"),
        "progress_pct": job.get("progress_pct", 0),
        "job_id": str(job["_id"]),
        "model_used": job.get("model_used"),
        "detected_lang": job.get("detected_lang"),
        "error_message": job.get("error_message"),
        "error_code": job.get("error_code"),
        "completed_at": str(job.get("completed_at", "")),
        "track_id": str(track["_id"]) if track else None,
        "cue_count": len(cues),
        "cues": cues,
    }
