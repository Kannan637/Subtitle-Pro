"""Long-to-Shorts router.

Creates shorts suggestions from project subtitles and supports YouTube imports.
"""
from __future__ import annotations

import mimetypes
import asyncio
import logging
import os
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from app.core.config import settings
from app.core.security import get_current_active_user
from app.db.database import get_database
from app.api.routers.export import CaptionStyle, CueInput, PreviewViewport, _ass_filter, generate_ass_content
from app.services.groq_service import get_groq_client
from app.services.long_to_shorts_service import (
    build_shorts_from_cues,
    build_viral_shorts_from_cues,
    detect_important_words,
    download_youtube_video,
    fetch_youtube_metadata,
    normalize_youtube_url,
    pick_related_emoji,
    split_caption_cue_to_chunks,
)

router = APIRouter(prefix="/long-to-shorts", tags=["Long-to-Shorts"])
logger = logging.getLogger(__name__)

SUPPORTED_SHORTS_RATIOS = {"9:16", "16:9"}
SUPPORTED_REFRAME_MODES = {"person_center", "fit_blur", "none"}
SUPPORTED_CAPTION_STYLES = {"comic_story", "clean_modern", "subtitle_minimal"}


class AnalyzeShortsRequest(BaseModel):
    target_count: int = Field(default=0, ge=0, le=50)
    min_duration_sec: int = Field(default=15, ge=5, le=60)
    max_duration_sec: int = Field(default=45, ge=8, le=60)
    target_aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    reframe_mode: Literal["person_center", "fit_blur", "none"] = "person_center"
    caption_style: str = Field(default="comic_story", min_length=2, max_length=40)


class YouTubeImportRequest(BaseModel):
    youtube_url: str
    project_name: str | None = None


def _require_owned_project_obj_id(project_id: str) -> ObjectId:
    try:
        _id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")
    return _id


async def _ensure_owned_project(project_id: str, user_id: str, db: Any) -> dict[str, Any]:
    obj_id = _require_owned_project_obj_id(project_id)
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _load_track_for_project(project_id: str, db: Any) -> dict[str, Any] | None:
    track = await db.subtitle_tracks.find_one(
        {"project_id": project_id, "is_active": True},
        sort=[("updated_at", -1), ("created_at", -1)],
    )
    if track:
        return track

    track = await db.subtitle_tracks.find_one(
        {"project_id": project_id, "is_original": True},
        sort=[("updated_at", -1), ("created_at", -1)],
    )
    if track:
        return track

    return await db.subtitle_tracks.find_one(
        {"project_id": project_id},
        sort=[("updated_at", -1), ("created_at", -1)],
    )


def _variant_key(target_ratio: str, reframe_mode: str) -> str:
    suffix = "fit_blur" if reframe_mode == "fit_blur" else "person_crop"
    return f"{target_ratio.replace(':', 'x')}_{suffix}"


def _smart_fit_reframe_payload(
    target_ratio: str,
    reframe_mode: str = "person_center",
    reason: str = "reframe_fallback",
) -> dict[str, Any]:
    return {
        "path": None,
        "target_ratio": target_ratio,
        "reframe_mode": reframe_mode,
        "method": "smart_fit",
        "subject_x_pct": None,
        "fallback_reason": reason,
    }


def _extract_cropped_variant_path(
    media: dict[str, Any],
    target_ratio: str,
    reframe_mode: str = "person_center",
) -> str | None:
    variants = media.get("cropped_variants")
    if isinstance(variants, dict):
        variant = variants.get(_variant_key(target_ratio, reframe_mode))
        if isinstance(variant, dict):
            path = str(variant.get("path") or "")
            if path and os.path.exists(path):
                return path

        # Backward compatibility with crop variants generated before framing modes existed.
        if reframe_mode != "fit_blur":
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


async def _ensure_reframed_variant(
    project_id: str,
    target_ratio: str,
    reframe_mode: str,
    db: Any,
) -> dict[str, Any] | None:
    media = await db.media_files.find_one({"project_id": project_id})
    if not media:
        return None

    existing_path = _extract_cropped_variant_path(media, target_ratio, reframe_mode)
    if existing_path:
        variant = (media.get("cropped_variants") or {}).get(_variant_key(target_ratio, reframe_mode), {})
        if not isinstance(variant, dict) and reframe_mode != "fit_blur":
            variant = (media.get("cropped_variants") or {}).get(target_ratio, {})
        if isinstance(variant, dict):
            return {
                "path": existing_path,
                "target_ratio": target_ratio,
                "reframe_mode": reframe_mode,
                "method": variant.get("method") or "subject_crop",
                "subject_x_pct": variant.get("subject_x_pct"),
            }
        return {"path": existing_path, "target_ratio": target_ratio, "reframe_mode": reframe_mode, "method": "subject_crop"}

    source_path = str(media.get("local_path") or "")
    if not source_path or not os.path.exists(source_path):
        return None

    base, _ext = os.path.splitext(source_path)
    variant_key = _variant_key(target_ratio, reframe_mode)
    output_path = f"{base}_reframed_{variant_key}.mp4"
    crop_fit_mode = "fit_blur_bg" if reframe_mode == "fit_blur" else "person_crop"

    from app.services.crop_service import crop_video
    try:
        result = await crop_video(source_path, output_path, target_ratio, fit_mode=crop_fit_mode)  # type: ignore[arg-type]
    except Exception as first_exc:
        logger.warning(
            "primary reframe failed for project=%s ratio=%s; retrying center fallback: %s",
            project_id,
            target_ratio,
            first_exc,
        )
        try:
            result = await crop_video(source_path, output_path, target_ratio, subject_x_pct=0.5, fit_mode=crop_fit_mode)  # type: ignore[arg-type]
        except Exception as second_exc:
            logger.warning(
                "center reframe fallback failed for project=%s ratio=%s: %s",
                project_id,
                target_ratio,
                second_exc,
            )
            if target_ratio == "9:16":
                return _smart_fit_reframe_payload(target_ratio, reframe_mode, "reframe_generation_failed")
            raise

    if not os.path.exists(output_path):
        if target_ratio == "9:16":
            return _smart_fit_reframe_payload(target_ratio, reframe_mode, "reframe_output_missing")
        raise RuntimeError("Reframe output was not created")

    now = datetime.now(timezone.utc)
    variant_payload = {
        "path": output_path,
        "target_ratio": target_ratio,
        "reframe_mode": reframe_mode,
        "method": result.get("method") or "subject_crop",
        "subject_x_pct": result.get("subject_x_pct"),
        "created_at": now,
    }
    await db.media_files.update_one(
        {"_id": media["_id"]},
        {"$set": {
            "cropped_path": output_path,
            "target_ratio": target_ratio,
            f"cropped_variants.{variant_key}": variant_payload,
            "updated_at": now,
        }},
    )
    return variant_payload


def _cleanup_paths(paths: list[str]) -> None:
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except OSError:
            logger.debug("Could not remove temporary long-to-shorts export path: %s", path)


def _safe_export_filename(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {" ", "-", "_"} else "-" for ch in (value or "short"))
    cleaned = " ".join(cleaned.split()).strip().replace(" ", "-")
    return (cleaned or "short")[:90]


def _target_dimensions(aspect_ratio: str) -> tuple[int, int]:
    return (720, 1280) if aspect_ratio == "9:16" else (1280, 720)


def _fit_blur_filter_complex(target_w: int, target_h: int, ass_filter: str) -> str:
    return (
        "[0:v]split=2[bg][fg];"
        f"[bg]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
        f"crop={target_w}:{target_h},boxblur=18:3[bgf];"
        f"[fg]scale={target_w}:{target_h}:force_original_aspect_ratio=decrease[fgf];"
        f"[bgf][fgf]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p,setpts=PTS-STARTPTS,{ass_filter}[v]"
    )


def _estimate_emoji_window_for_cue(
    text: str,
    highlight_words: list[str],
    cue_start_ms: int,
    cue_end_ms: int,
) -> tuple[int, int] | None:
    tokens = [token for token in re.findall(r"\S+", text or "") if token]
    highlight_set = {
        normalized
        for word in highlight_words
        if (normalized := re.sub(r"[^A-Za-z0-9']+", "", str(word).lower()))
    }
    if not tokens or not highlight_set or cue_end_ms <= cue_start_ms:
        return None

    weights = [max(1, len(re.sub(r"[^A-Za-z0-9']+", "", token) or token)) for token in tokens]
    total_weight = max(1, sum(weights))
    duration_ms = max(1, cue_end_ms - cue_start_ms)
    cursor = 0
    for index, token in enumerate(tokens):
        token_start = cue_start_ms + int(round(duration_ms * (cursor / total_weight)))
        cursor += weights[index]
        token_end = cue_start_ms + int(round(duration_ms * (cursor / total_weight)))
        normalized = re.sub(r"[^A-Za-z0-9']+", "", token.lower())
        if normalized in highlight_set:
            return token_start, max(token_start + 1, token_end)
    return None


def _caption_style_for_short(caption_style: str) -> CaptionStyle:
    normalized = (caption_style or "").strip().lower()
    if normalized == "subtitle_minimal":
        return CaptionStyle(
            fontFamily="Inter",
            fontSize=30,
            fontWeight=700,
        color="#FFFFFF",
        highlightColor="#FFD400",
        strokeColor="#000000",
        strokeWidth=2,
            background="transparent",
            shadowColor="rgba(0,0,0,0.72)",
            position="center",
            align="center",
            maxWidthPct=84,
            captionMode="chunk",
        )
    if normalized == "clean_modern":
        return CaptionStyle(
            fontFamily="Plus Jakarta Sans",
            fontSize=32,
            fontWeight=800,
        color="#FFFFFF",
        highlightColor="#FFD400",
        strokeColor="#000000",
        strokeWidth=2.4,
            background="transparent",
            shadowColor="rgba(0,0,0,0.78)",
            position="center",
            align="center",
            maxWidthPct=84,
            captionMode="chunk",
        )
    return CaptionStyle(
        fontFamily="Komika Axis",
        fontSize=36,
        fontWeight=900,
        uppercase=True,
        textCase="upper",
        color="#FFFFFF",
        highlightColor="#FFD400",
        strokeColor="#000000",
        strokeWidth=3.2,
        background="transparent",
        shadowColor="rgba(0,0,0,0.88)",
        position="center",
        align="center",
        maxWidthPct=82,
        captionMode="chunk",
    )


def _coerce_timed_caption_cues(short: dict[str, Any]) -> list[dict[str, Any]]:
    short_start_ms = int(short.get("start_ms", 0) or 0)
    short_end_ms = int(short.get("end_ms", short_start_ms) or short_start_ms)
    duration_ms = max(1, short_end_ms - short_start_ms)
    raw_cues = short.get("caption_cues")
    cues: list[dict[str, Any]] = []

    if isinstance(raw_cues, list):
        for cue in raw_cues:
            if not isinstance(cue, dict):
                continue
            text = str(cue.get("text", "") or "").strip()
            if not text:
                continue

            rel_start = cue.get("relative_start_ms")
            rel_end = cue.get("relative_end_ms")
            if cue.get("start_ms") is None and rel_start is not None:
                start_ms = short_start_ms + int(rel_start or 0)
            else:
                start_ms = int(cue.get("start_ms", short_start_ms) or short_start_ms)
            if cue.get("end_ms") is None and rel_end is not None:
                end_ms = short_start_ms + int(rel_end or 0)
            else:
                end_ms = int(cue.get("end_ms", start_ms) or start_ms)

            start_ms = max(short_start_ms, start_ms)
            end_ms = min(short_end_ms, end_ms)
            if end_ms <= start_ms:
                continue
            source_words = cue.get("words") if isinstance(cue.get("words"), list) else []
            highlight_words = cue.get("highlight_words") if isinstance(cue.get("highlight_words"), list) else []
            if not highlight_words:
                highlight_words = detect_important_words(text)
            emoji = pick_related_emoji(text, [str(word) for word in highlight_words if str(word).strip()])
            cues.extend(
                split_caption_cue_to_chunks(
                    {
                        "text": text,
                        "start_ms": start_ms,
                        "end_ms": end_ms,
                        "words": source_words,
                        "highlight_words": highlight_words,
                        "emoji": emoji,
                    },
                    short_start_ms,
                    short_end_ms,
                )
            )

    if cues:
        return sorted(cues, key=lambda cue: (cue["start_ms"], cue["end_ms"]))

    fallback_lines = [
        str(line).strip()
        for line in short.get("captions", [])
        if str(line).strip()
    ]
    if not fallback_lines:
        primary = str(short.get("primary_caption", "") or "").strip()
        fallback_lines = [primary] if primary else []
    if not fallback_lines:
        return []

    slot_ms = max(1, duration_ms // max(1, len(fallback_lines)))
    for index, line in enumerate(fallback_lines):
        start_ms = short_start_ms + index * slot_ms
        end_ms = short_end_ms if index == len(fallback_lines) - 1 else min(short_end_ms, start_ms + slot_ms)
        if end_ms <= start_ms:
            continue
        cues.extend(
            split_caption_cue_to_chunks(
                {
                    "text": line,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "emoji": pick_related_emoji(line, detect_important_words(line)),
                },
                short_start_ms,
                short_end_ms,
            )
        )
    return cues


async def _load_timed_cues_for_window(
    db: Any,
    track_id: str,
    start_ms: int,
    end_ms: int,
) -> list[dict[str, Any]]:
    if not track_id:
        return []

    cues: list[dict[str, Any]] = []
    cursor = db.subtitle_cues.find(
        {
            "track_id": track_id,
            "start_ms": {"$lt": end_ms},
            "end_ms": {"$gt": start_ms},
        }
    ).sort("sequence", 1)

    async for cue in cursor:
        text = str(cue.get("text", "") or "").strip()
        cue_start = max(start_ms, int(cue.get("start_ms", 0) or 0))
        cue_end = min(end_ms, int(cue.get("end_ms", 0) or 0))
        if not text or cue_end <= cue_start:
            continue
        cues.extend(
            split_caption_cue_to_chunks(
                {
                    "id": str(cue.get("_id", "") or ""),
                    "text": text,
                    "start_ms": cue_start,
                    "end_ms": cue_end,
                    "words": cue.get("words") if isinstance(cue.get("words"), list) else [],
                    "emoji": pick_related_emoji(text, detect_important_words(text)),
                },
                start_ms,
                end_ms,
            )
        )
    return cues


async def _resolve_short_source_path(
    project: dict[str, Any],
    project_id: str,
    aspect_ratio: str,
    reframe_mode: str,
    db: Any,
) -> str | None:
    media = await db.media_files.find_one({"project_id": project_id})

    if reframe_mode == "fit_blur":
        candidates = [
            str((media or {}).get("local_path") or ""),
            str(project.get("media_url") or ""),
        ]
        for path in candidates:
            if path and os.path.exists(path):
                return path
        return None

    if reframe_mode in {"person_center", "fit_blur"} and media:
        existing_path = _extract_cropped_variant_path(media, aspect_ratio, reframe_mode)
        if existing_path:
            return existing_path
        try:
            variant = await _ensure_reframed_variant(project_id, aspect_ratio, reframe_mode, db)
            variant_path = str((variant or {}).get("path") or "")
            if variant_path and os.path.exists(variant_path):
                return variant_path
        except Exception as exc:
            logger.warning("Could not generate reframe before short download for project %s: %s", project_id, exc)

    candidates = [
        str((media or {}).get("local_path") or ""),
        str(project.get("media_url") or ""),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


async def _hydrate_shorts_with_timed_cues(
    db: Any,
    track_id: str,
    shorts: Any,
) -> list[Any]:
    if not isinstance(shorts, list):
        return []

    hydrated: list[Any] = []
    for item in shorts:
        if not isinstance(item, dict):
            hydrated.append(item)
            continue

        existing_cues = item.get("caption_cues")
        if isinstance(existing_cues, list) and existing_cues:
            hydrated.append(item)
            continue

        start_ms = int(item.get("start_ms", 0) or 0)
        end_ms = int(item.get("end_ms", 0) or 0)
        timed_cues = await _load_timed_cues_for_window(db, track_id, start_ms, end_ms)
        if timed_cues:
            copy = dict(item)
            copy["caption_cues"] = timed_cues
            hydrated.append(copy)
        else:
            hydrated.append(item)

    return _sort_shorts_by_score(hydrated)


def _sort_shorts_by_score(shorts: Any) -> list[Any]:
    if not isinstance(shorts, list):
        return []

    def sort_key(item: Any) -> tuple[float, float, float, int]:
        if not isinstance(item, dict):
            return (0.0, 0.0, 0.0, 0)
        breakdown = item.get("score_breakdown") if isinstance(item.get("score_breakdown"), dict) else {}
        try:
            score = float(item.get("engagement_rate", 0) or 0)
        except Exception:
            score = 0.0
        try:
            hook_score = float(item.get("hook_score", breakdown.get("hook_quality", 0)) or 0)
        except Exception:
            hook_score = 0.0
        try:
            coherence = float(breakdown.get("standalone_coherence", 0) or 0)
        except Exception:
            coherence = 0.0
        try:
            start_ms = int(item.get("start_ms", 0) or 0)
        except Exception:
            start_ms = 0
        return (-score, -hook_score, -coherence, start_ms)

    return sorted(shorts, key=sort_key)


@router.post("/youtube")
async def import_youtube_video(
    body: YouTubeImportRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        normalized_url = normalize_youtube_url(body.youtube_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        metadata = await asyncio.to_thread(fetch_youtube_metadata, normalized_url)
        project_name = (body.project_name or "").strip() or str(metadata.get("title") or "YouTube Import")
        now = datetime.now(timezone.utc)
        project_doc = {
            "name": project_name,
            "type": "long_to_shorts",
            "user_id": user_id,
            "status": "processing",
            "created_at": now,
            "updated_at": now,
        }
        project_result = await db.projects.insert_one(project_doc)
        project_id = str(project_result.inserted_id)

        download_result = await asyncio.to_thread(download_youtube_video, normalized_url, project_id, "uploads")
        file_path = str(download_result.get("file_path") or "")
        if not file_path or not os.path.exists(file_path):
            raise RuntimeError("Downloaded media file not found")

        guessed_mime = mimetypes.guess_type(file_path)[0] or "video/mp4"
        file_size = os.path.getsize(file_path)
        original_filename = os.path.basename(file_path)
        safe_filename = original_filename
        duration_sec = int(download_result.get("duration_sec") or metadata.get("duration_sec") or 0)

        media_doc = {
            "project_id": project_id,
            "original_filename": original_filename,
            "safe_filename": safe_filename,
            "size_bytes": file_size,
            "format": guessed_mime,
            "local_path": file_path,
            "source": "youtube",
            "source_url": normalized_url,
            "source_video_id": str(metadata.get("video_id") or ""),
            "created_at": now,
        }
        await db.media_files.update_one(
            {"project_id": project_id},
            {"$set": media_doc},
            upsert=True,
        )

        await db.projects.update_one(
            {"_id": project_result.inserted_id},
            {"$set": {
                "media_url": file_path,
                "status": "ready",
                "duration_sec": duration_sec if duration_sec > 0 else None,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"YouTube import failed: {exc}")

    return {
        "project_id": project_id,
        "status": "ready",
        "youtube_url": normalized_url,
        "title": str(metadata.get("title") or project_name),
        "duration_sec": int(metadata.get("duration_sec") or 0),
        "message": "YouTube video imported successfully",
    }


@router.get("/preflight")
async def long_to_shorts_preflight(
    current_user: dict = Depends(get_current_active_user),
):
    credits_remaining = int(current_user.get("credits_remaining") or 0)
    groq_configured = bool(settings.groq_api_key)
    groq_valid = False
    groq_error = ""
    if groq_configured:
        try:
            client = get_groq_client()
            await asyncio.to_thread(client.models.list)
            groq_valid = True
        except Exception as exc:
            groq_valid = False
            groq_error = str(exc)

    yt_dlp_available = shutil.which("yt-dlp") is not None
    ffmpeg_available = shutil.which("ffmpeg") is not None
    ffprobe_available = shutil.which("ffprobe") is not None

    checks = {
        "groq_api_key_configured": groq_configured,
        "groq_api_key_valid": groq_valid,
        "yt_dlp_available": yt_dlp_available,
        "ffmpeg_available": ffmpeg_available,
        "ffprobe_available": ffprobe_available,
        "credits_remaining": credits_remaining,
        "can_start_transcription": credits_remaining > 0 and groq_valid and ffmpeg_available,
    }

    issues: list[str] = []
    if not groq_configured:
        issues.append("AI transcription is not configured for this workspace.")
    elif not groq_valid:
        if groq_error:
            issues.append("AI transcription is temporarily unavailable for this workspace.")
        else:
            issues.append("AI transcription is temporarily unavailable for this workspace.")
    if not yt_dlp_available:
        issues.append("Video import is not available on this workspace.")
    if not ffmpeg_available:
        issues.append("Video processing is not available on this workspace.")
    if not ffprobe_available:
        issues.append("Media analysis is not available on this workspace.")
    if credits_remaining <= 0:
        issues.append("No transcription credits remaining for current account.")

    return {
        "status": "ok" if not issues else "needs_attention",
        "checks": checks,
        "issues": issues,
    }


@router.post("/{project_id}/analyze")
async def analyze_project_for_shorts(
    project_id: str,
    body: AnalyzeShortsRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    if body.max_duration_sec <= body.min_duration_sec:
        raise HTTPException(status_code=400, detail="max_duration_sec must be greater than min_duration_sec")
    if body.target_aspect_ratio not in SUPPORTED_SHORTS_RATIOS:
        raise HTTPException(status_code=400, detail=f"Unsupported target_aspect_ratio: {body.target_aspect_ratio}")
    if body.reframe_mode not in SUPPORTED_REFRAME_MODES:
        raise HTTPException(status_code=400, detail=f"Unsupported reframe_mode: {body.reframe_mode}")

    caption_style = (body.caption_style or "").strip().lower()
    if caption_style not in SUPPORTED_CAPTION_STYLES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported caption_style: {body.caption_style}. Valid: {sorted(SUPPORTED_CAPTION_STYLES)}",
        )

    await _ensure_owned_project(project_id, user_id, db)

    track = await _load_track_for_project(project_id, db)
    if not track:
        raise HTTPException(status_code=400, detail="No subtitle track found for this project")

    track_id = str(track.get("_id", ""))
    if not track_id:
        raise HTTPException(status_code=400, detail="Invalid subtitle track")

    cues: list[dict[str, Any]] = []
    cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
    async for cue in cursor:
        cues.append({
            "_id": str(cue.get("_id", "")),
            "text": str(cue.get("text", "") or "").strip(),
            "start_ms": int(cue.get("start_ms", 0) or 0),
            "end_ms": int(cue.get("end_ms", 0) or 0),
            "words": cue.get("words") if isinstance(cue.get("words"), list) else [],
        })

    if not cues:
        raise HTTPException(status_code=400, detail="No subtitle cues found. Run transcription first.")

    requested_target_count = int(body.target_count or 0)
    fallback_target_count = requested_target_count if requested_target_count > 0 else 30
    try:
        shorts, selection_engine, analysis_warnings = await asyncio.to_thread(
            build_viral_shorts_from_cues,
            cues=cues,
            target_count=requested_target_count,
            min_duration_sec=body.min_duration_sec,
            max_duration_sec=body.max_duration_sec,
            target_aspect_ratio=body.target_aspect_ratio,
            caption_style=caption_style,
            reframe_mode=body.reframe_mode,
        )
    except Exception as exc:
        logger.exception("Long to Viral analysis fallback activated for project %s: %s", project_id, exc)
        shorts = build_shorts_from_cues(
            cues=cues,
            target_count=fallback_target_count,
            min_duration_sec=body.min_duration_sec,
            max_duration_sec=body.max_duration_sec,
            target_aspect_ratio=body.target_aspect_ratio,
            caption_style=caption_style,
            reframe_mode=body.reframe_mode,
        )
        selection_engine = "heuristic_hook_scorer"
        analysis_warnings = ["AI viral analysis recovered with deterministic hook scoring."]
    if not shorts:
        shorts = build_shorts_from_cues(
            cues=cues,
            target_count=fallback_target_count,
            min_duration_sec=body.min_duration_sec,
            max_duration_sec=body.max_duration_sec,
            target_aspect_ratio=body.target_aspect_ratio,
            caption_style=caption_style,
            reframe_mode=body.reframe_mode,
        )
        selection_engine = "heuristic_hook_scorer"
    shorts = _sort_shorts_by_score(shorts)
    warnings: list[str] = [str(warning) for warning in analysis_warnings if str(warning).strip()]
    reframe: dict[str, Any] | None = None
    if body.reframe_mode == "fit_blur":
        reframe = _smart_fit_reframe_payload(body.target_aspect_ratio, body.reframe_mode, "user_selected_fit_blur")
        warnings.append("Using 16:9 fit-in with a blurred full-frame video background.")
    elif body.reframe_mode == "person_center":
        try:
            reframe = await _ensure_reframed_variant(project_id, body.target_aspect_ratio, body.reframe_mode, db)
            if isinstance(reframe, dict) and str(reframe.get("method")) == "smart_fit":
                warnings.append(
                    "Detected framing risk for portrait crop. Using 16:9 fit-in with blurred background for better subject visibility."
                )
        except Exception as exc:
            logger.warning("reframe generation failed for project %s: %s", project_id, exc)
            if body.target_aspect_ratio == "9:16":
                reframe = _smart_fit_reframe_payload(
                    body.target_aspect_ratio,
                    body.reframe_mode,
                    "reframe_generation_failed",
                )
                warnings.append(
                    "Detected framing risk for portrait crop. Using 16:9 fit-in with blurred background for better subject visibility."
                )
            else:
                reframe = {
                    "path": None,
                    "target_ratio": body.target_aspect_ratio,
                    "reframe_mode": body.reframe_mode,
                    "method": "original",
                    "subject_x_pct": None,
                    "fallback_reason": "reframe_generation_failed",
                }
                warnings.append("Using source framing for this output ratio.")

    now = datetime.now(timezone.utc)
    job_doc = {
        "project_id": project_id,
        "user_id": user_id,
        "status": "complete",
        "target_count": len(shorts) if requested_target_count == 0 else requested_target_count,
        "requested_target_count": requested_target_count,
        "auto_clip_count": requested_target_count == 0,
        "min_duration_sec": body.min_duration_sec,
        "max_duration_sec": body.max_duration_sec,
        "target_aspect_ratio": body.target_aspect_ratio,
        "reframe_mode": body.reframe_mode,
        "caption_style": caption_style,
        "selection_engine": selection_engine,
        "track_id": track_id,
        "reframe": reframe,
        "warnings": warnings,
        "shorts": shorts,
        "shorts_count": len(shorts),
        "created_at": now,
        "completed_at": now,
    }
    result = await db.long_to_shorts_jobs.insert_one(job_doc)

    return {
        "job_id": str(result.inserted_id),
        "project_id": project_id,
        "status": "complete",
        "track_id": track_id,
        "shorts_count": len(shorts),
        "target_aspect_ratio": body.target_aspect_ratio,
        "reframe_mode": body.reframe_mode,
        "caption_style": caption_style,
        "selection_engine": selection_engine,
        "target_count": len(shorts) if requested_target_count == 0 else requested_target_count,
        "requested_target_count": requested_target_count,
        "auto_clip_count": requested_target_count == 0,
        "reframe": reframe,
        "warnings": warnings,
        "shorts": shorts,
    }


@router.get("/{project_id}/shorts/{short_id}/download")
async def download_long_to_shorts_clip(
    project_id: str,
    short_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    if shutil.which("ffmpeg") is None:
        raise HTTPException(status_code=503, detail="FFmpeg is required to render short downloads")

    project = await _ensure_owned_project(project_id, user_id, db)
    job = await db.long_to_shorts_jobs.find_one(
        {"project_id": project_id, "user_id": user_id},
        sort=[("created_at", -1)],
    )
    if not job:
        raise HTTPException(status_code=404, detail="No long-to-shorts analysis found for this project")

    shorts = job.get("shorts", [])
    if not isinstance(shorts, list):
        shorts = []
    short = next(
        (
            item
            for item in shorts
            if isinstance(item, dict) and str(item.get("short_id", "")) == short_id
        ),
        None,
    )
    if not short:
        raise HTTPException(status_code=404, detail="Short clip not found")

    start_ms = int(short.get("start_ms", 0) or 0)
    end_ms = int(short.get("end_ms", 0) or 0)
    duration_ms = end_ms - start_ms
    if start_ms < 0 or duration_ms <= 0:
        raise HTTPException(status_code=400, detail="Short clip has invalid timing")

    aspect_ratio = str(short.get("aspect_ratio") or job.get("target_aspect_ratio") or "9:16")
    if aspect_ratio not in SUPPORTED_SHORTS_RATIOS:
        aspect_ratio = "9:16"
    reframe_mode = str(short.get("reframe_mode") or job.get("reframe_mode") or "person_center")
    if reframe_mode not in SUPPORTED_REFRAME_MODES:
        reframe_mode = "person_center"

    source_path = await _resolve_short_source_path(project, project_id, aspect_ratio, reframe_mode, db)
    if not source_path:
        raise HTTPException(status_code=404, detail="Project media file not found for download")

    timed_cues: list[dict[str, Any]] = []
    if isinstance(short.get("caption_cues"), list):
        timed_cues = _coerce_timed_caption_cues(short)
    if not timed_cues:
        timed_cues = await _load_timed_cues_for_window(
            db,
            str(job.get("track_id", "") or ""),
            start_ms,
            end_ms,
        )
    if not timed_cues:
        timed_cues = _coerce_timed_caption_cues(short)

    cue_inputs: list[CueInput] = []
    for cue in timed_cues:
        text = str(cue.get("text", "") or "").strip()
        cue_start_ms = max(0, int(cue.get("start_ms", start_ms) or start_ms) - start_ms)
        cue_end_ms = min(duration_ms, int(cue.get("end_ms", end_ms) or end_ms) - start_ms)
        if not text or cue_end_ms <= cue_start_ms:
            continue
        highlight_words = cue.get("highlight_words") if isinstance(cue.get("highlight_words"), list) else []
        if not highlight_words:
            highlight_words = detect_important_words(text)
        emoji_start_ms: int | None = None
        emoji_end_ms: int | None = None
        try:
            raw_emoji_start = cue.get("emoji_start_ms")
            raw_emoji_end = cue.get("emoji_end_ms")
            if raw_emoji_start is None and cue.get("emoji_relative_start_ms") is not None:
                raw_emoji_start = start_ms + int(cue.get("emoji_relative_start_ms") or 0)
            if raw_emoji_end is None and cue.get("emoji_relative_end_ms") is not None:
                raw_emoji_end = start_ms + int(cue.get("emoji_relative_end_ms") or 0)
            if raw_emoji_start is not None and raw_emoji_end is not None:
                emoji_start_ms = max(0, int(raw_emoji_start or 0) - start_ms)
                emoji_end_ms = min(duration_ms, int(raw_emoji_end or 0) - start_ms)
                if emoji_end_ms <= emoji_start_ms:
                    emoji_start_ms = None
                    emoji_end_ms = None
        except Exception:
            emoji_start_ms = None
            emoji_end_ms = None
        clean_highlight_words = [str(word) for word in highlight_words if str(word).strip()]
        emoji = pick_related_emoji(text, clean_highlight_words)
        if emoji and (emoji_start_ms is None or emoji_end_ms is None):
            estimated_window = _estimate_emoji_window_for_cue(text, clean_highlight_words, cue_start_ms, cue_end_ms)
            if estimated_window:
                emoji_start_ms, emoji_end_ms = estimated_window
        cue_inputs.append(
            CueInput(
                text=text,
                start_ms=cue_start_ms,
                end_ms=cue_end_ms,
                highlight_words=clean_highlight_words,
                emoji=emoji,
                emoji_start_ms=emoji_start_ms,
                emoji_end_ms=emoji_end_ms,
            )
        )

    if not cue_inputs:
        fallback_text = str(short.get("primary_caption", "") or "").strip()
        if fallback_text:
            fallback_highlights = detect_important_words(fallback_text)
            fallback_emoji = pick_related_emoji(fallback_text, fallback_highlights)
            fallback_emoji_window = _estimate_emoji_window_for_cue(
                fallback_text,
                fallback_highlights,
                0,
                duration_ms,
            )
            cue_inputs.append(
                CueInput(
                    text=fallback_text,
                    start_ms=0,
                    end_ms=duration_ms,
                    highlight_words=fallback_highlights,
                    emoji=fallback_emoji,
                    emoji_start_ms=fallback_emoji_window[0] if fallback_emoji_window else None,
                    emoji_end_ms=fallback_emoji_window[1] if fallback_emoji_window else None,
                )
            )

    target_w, target_h = _target_dimensions(aspect_ratio)
    caption_style_value = str(short.get("caption_style") or job.get("caption_style") or "comic_story")
    style = _caption_style_for_short(caption_style_value)
    reframe_info = job.get("reframe") if isinstance(job.get("reframe"), dict) else {}
    if aspect_ratio == "9:16" and (
        reframe_mode == "fit_blur" or str(reframe_info.get("method") or "") == "smart_fit"
    ):
        style.position = "center"
        style.offsetY = target_h * 0.22
        style.maxWidthPct = min(float(style.maxWidthPct or 82), 82)
    ass_content = generate_ass_content(
        cues=cue_inputs,
        style=style,
        video_width=target_w,
        video_height=target_h,
        preview_viewport=PreviewViewport(width=target_w, height=target_h),
    )

    export_dir = os.path.join("uploads", "exports", "shorts")
    os.makedirs(export_dir, exist_ok=True)
    token = uuid.uuid4().hex
    ass_path = os.path.join(export_dir, f"{project_id}_{short_id}_{token}.ass")
    output_path = os.path.join(export_dir, f"{project_id}_{short_id}_{token}.mp4")
    with open(ass_path, "w", encoding="utf-8") as handle:
        handle.write(ass_content)

    use_fit_blur_render = aspect_ratio == "9:16" and (
        reframe_mode == "fit_blur" or str(reframe_info.get("method") or "") == "smart_fit"
    )
    scale_filter = (
        f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
        f"crop={target_w}:{target_h},setsar=1,setpts=PTS-STARTPTS"
    )
    ass_filter = _ass_filter(ass_path.replace("\\", "/"))

    def _build_ffmpeg_command(video_filter: str, *, filter_complex: bool = False) -> list[str]:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            source_path,
            "-ss",
            f"{start_ms / 1000:.3f}",
            "-t",
            f"{duration_ms / 1000:.3f}",
        ]
        if filter_complex:
            cmd.extend(["-filter_complex", video_filter, "-map", "[v]", "-map", "0:a:0?"])
        else:
            cmd.extend(["-vf", video_filter, "-map", "0:v:0", "-map", "0:a:0?"])
        cmd.extend([
            "-sn",
            "-dn",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            "1",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output_path,
        ])
        return cmd

    try:
        video_filter = (
            _fit_blur_filter_complex(target_w, target_h, ass_filter)
            if use_fit_blur_render
            else f"{scale_filter},{ass_filter}"
        )
        proc = await asyncio.to_thread(
            subprocess.run,
            _build_ffmpeg_command(video_filter, filter_complex=use_fit_blur_render),
            capture_output=True,
            text=True,
            timeout=900,
        )
    except Exception as exc:
        _cleanup_paths([ass_path, output_path])
        raise HTTPException(status_code=500, detail=f"Short export failed: {exc}") from exc

    if proc.returncode != 0 or not os.path.exists(output_path):
        _cleanup_paths([ass_path, output_path])
        error_text = (proc.stderr or proc.stdout or "Unknown FFmpeg error").strip()
        logger.error("long-to-shorts short export failed project=%s short=%s: %s", project_id, short_id, error_text[:1200])
        raise HTTPException(status_code=500, detail=f"Short export failed: {error_text[:500]}")

    project_name = str(project.get("name") or "subtitlepro-short")
    filename = f"{_safe_export_filename(project_name)}-{_safe_export_filename(short_id)}.mp4"
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=filename,
        background=BackgroundTask(_cleanup_paths, [ass_path, output_path]),
    )


@router.get("/{project_id}")
async def get_latest_long_to_shorts_result(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    await _ensure_owned_project(project_id, user_id, db)

    job = await db.long_to_shorts_jobs.find_one(
        {"project_id": project_id, "user_id": user_id},
        sort=[("created_at", -1)],
    )
    if not job:
        return {"status": "none", "message": "No long-to-shorts analysis found for this project"}

    track_id = str(job.get("track_id", "") or "")
    shorts = await _hydrate_shorts_with_timed_cues(db, track_id, job.get("shorts", []))
    reframe_mode = str(job.get("reframe_mode", "person_center"))
    reframe = job.get("reframe")
    warnings = job.get("warnings", [])
    if not isinstance(warnings, list):
        warnings = []
    if reframe_mode == "fit_blur":
        if not isinstance(reframe, dict):
            reframe = _smart_fit_reframe_payload(str(job.get("target_aspect_ratio", "9:16")), "fit_blur", "user_selected_fit_blur")
        warnings = [
            str(warning)
            for warning in warnings
            if "Reframe generation failed" not in str(warning)
        ]
        fit_blur_warning = "Using 16:9 fit-in with a blurred full-frame video background."
        if fit_blur_warning not in warnings:
            warnings.append(fit_blur_warning)
    elif reframe_mode == "person_center" and str(job.get("target_aspect_ratio", "9:16")) == "9:16":
        had_failed_reframe_warning = any("Reframe generation failed" in str(warning) for warning in warnings)
        warnings = [
            str(warning)
            for warning in warnings
            if "Reframe generation failed" not in str(warning)
        ]
        if had_failed_reframe_warning and not isinstance(reframe, dict):
            reframe = _smart_fit_reframe_payload("9:16", "person_center", "reframe_generation_failed")
        if isinstance(reframe, dict) and str(reframe.get("method") or "") == "smart_fit":
            smart_warning = (
                "Detected framing risk for portrait crop. Using 16:9 fit-in with blurred background for better subject visibility."
            )
            if smart_warning not in warnings:
                warnings.append(smart_warning)

    return {
        "job_id": str(job.get("_id")),
        "project_id": project_id,
        "status": str(job.get("status", "unknown")),
        "shorts_count": int(job.get("shorts_count", 0) or 0),
        "target_count": int(job.get("target_count", 0) or 0),
        "requested_target_count": int(job.get("requested_target_count", job.get("target_count", 0)) or 0),
        "auto_clip_count": bool(job.get("auto_clip_count", False)),
        "min_duration_sec": int(job.get("min_duration_sec", 0) or 0),
        "max_duration_sec": int(job.get("max_duration_sec", 0) or 0),
        "target_aspect_ratio": str(job.get("target_aspect_ratio", "9:16")),
        "reframe_mode": reframe_mode,
        "caption_style": str(job.get("caption_style", "comic_story")),
        "selection_engine": str(job.get("selection_engine", "")),
        "track_id": track_id,
        "reframe": reframe,
        "warnings": warnings,
        "shorts": shorts,
        "created_at": str(job.get("created_at", "")),
        "completed_at": str(job.get("completed_at", "")),
    }
