"""Transition Service.

Generates FFmpeg ``xfade`` filter entries at boundaries between the main
talking-head clip and B-roll clips placed on the timeline.

The transition *type* is chosen by Groq based on video mood, or falls
back to ``"fade"``.

Public API
──────────
    async def build_transitions(
        project_id: str,
        db,
        transition_style: str = "auto",
    ) -> list[dict]

    async def render_with_transitions(
        main_video_path: str,
        broll_clips: list[dict],
        transitions: list[dict],
        output_path: str,
    ) -> dict
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services.groq_service import get_groq_client

logger = logging.getLogger(__name__)

# Supported xfade transition names (FFmpeg 6+)
_SUPPORTED_TRANSITIONS = {
    "fade", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown",
    "circlecrop", "rectcrop", "distance", "fadeblack",
    "fadewhite", "radial", "smoothleft", "smoothright",
    "pixelize", "diagtl", "diagtr", "diagbl", "diagbr",
    "hlslice", "hrslice", "vuslice", "vdslice", "dissolve",
    "hblur", "wipetl", "wipetr", "wipebl", "wipebr", "squeezeh",
    "squeezev", "zoomin", "hlwind", "hrwind", "vuwind", "vdwind",
    "coverleft", "coverright", "revealleft", "revealright",
}

_DEFAULT_DURATION_S = 0.5
_MAX_BROLL_DURATION_MS = 3000


# ─── Public API ───────────────────────────────────────────────────────────────

async def build_transitions(
    project_id: str,
    db: Any,
    transition_style: str = "auto",
) -> list[dict]:
    """Return a list of transition descriptors for the project.

    Each descriptor contains the ``offset_ms`` where the transition should
    be applied and the ``type`` of xfade to use.

    Args:
        project_id:        MongoDB project ID.
        db:                Async Motor database handle.
        transition_style:  ``"auto"`` (Groq picks), or any ``_SUPPORTED_TRANSITIONS``
                           member to force a specific style.
    """
    broll_docs = await _load_broll_boundaries(project_id, db)

    if not broll_docs:
        logger.info("build_transitions: no B-roll clips for project %s", project_id)
        return []

    # Pick transition type
    if transition_style == "auto":
        transcript = await _load_transcript_from_subtitle_cues(project_id, db)
        style = await _pick_transition_style(transcript)
    else:
        style = transition_style if transition_style in _SUPPORTED_TRANSITIONS else "fade"

    # Build transitions at each B-roll boundary
    transitions: list[dict] = []
    for clip in broll_docs:
        start_ms = int(clip.get("start_ms", 0))
        end_ms = int(clip.get("end_ms", start_ms + _MAX_BROLL_DURATION_MS))
        end_ms = min(end_ms, start_ms + _MAX_BROLL_DURATION_MS)
        clip_id = str(clip.get("clip_id", clip.get("_id", "")))
        transitions.append({
            "clip_id": clip_id,
            "offset_ms": start_ms,
            "end_ms": end_ms,
            "type": style,
            "duration_s": _DEFAULT_DURATION_S,
        })
        # Also add transition at clip exit
        transitions.append({
            "clip_id": clip_id + "_exit",
            "offset_ms": max(0, end_ms - int(_DEFAULT_DURATION_S * 1000)),
            "end_ms": end_ms,
            "type": style,
            "duration_s": _DEFAULT_DURATION_S,
        })

    logger.info(
        "build_transitions: %d transition(s) (style=%s) for project %s",
        len(transitions), style, project_id,
    )
    return transitions


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return default


async def _load_transcript_from_subtitle_cues(project_id: str, db: Any) -> str:
    # Prefer the active track when present; otherwise use original/latest track.
    track = await db.subtitle_tracks.find_one(
        {"project_id": project_id, "is_active": True},
        sort=[("updated_at", -1), ("created_at", -1)],
    )
    if not track:
        track = await db.subtitle_tracks.find_one(
            {"project_id": project_id},
            sort=[("is_original", -1), ("updated_at", -1), ("created_at", -1)],
        )
    if not track:
        return ""

    track_id = str(track.get("_id", ""))
    if not track_id:
        return ""

    parts: list[str] = []
    cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
    async for cue in cursor:
        text = str(cue.get("text", "") or "").strip()
        if text:
            parts.append(text)
    return " ".join(parts)


async def _load_broll_boundaries(project_id: str, db: Any) -> list[dict[str, Any]]:
    clips = await _load_orchestration_broll_boundaries(project_id, db)
    if clips:
        return clips
    return await _load_legacy_broll_boundaries(project_id, db)


async def _load_orchestration_broll_boundaries(project_id: str, db: Any) -> list[dict[str, Any]]:
    job = await db.orchestration_jobs.find_one(
        {"project_id": project_id, "results.broll": {"$exists": True}},
        sort=[("created_at", -1)],
    )
    if not job:
        return []

    raw = (job.get("results", {}) or {}).get("broll", [])
    if not isinstance(raw, list):
        return []

    clips: list[dict[str, Any]] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        broll_meta = item.get("broll")
        if not isinstance(broll_meta, dict) or not broll_meta.get("video_url"):
            continue

        start_ms = _coerce_int(item.get("start_ms"), 0)
        end_ms = _coerce_int(item.get("end_ms"), 0)
        if end_ms <= start_ms:
            duration_s = max(1, _coerce_int(broll_meta.get("duration"), 4))
            end_ms = start_ms + duration_s * 1000
        end_ms = min(end_ms, start_ms + _MAX_BROLL_DURATION_MS)

        clip_id = str(
            item.get("cue_id")
            or item.get("clip_id")
            or broll_meta.get("pexels_id")
            or f"broll_{idx}"
        )
        clips.append({
            "clip_id": clip_id,
            "start_ms": start_ms,
            "end_ms": end_ms,
        })

    clips.sort(key=lambda c: c.get("start_ms", 0))
    return clips


async def _load_legacy_broll_boundaries(project_id: str, db: Any) -> list[dict[str, Any]]:
    docs = await db.broll_clips.find({"project_id": project_id}).sort("start_ms", 1).to_list(length=200)
    clips: list[dict[str, Any]] = []
    for idx, clip in enumerate(docs):
        start_ms = _coerce_int(clip.get("start_ms"), 0)
        end_ms = _coerce_int(clip.get("end_ms"), 0)
        if end_ms <= start_ms:
            duration_s = max(1, _coerce_int(clip.get("duration"), 4))
            end_ms = start_ms + duration_s * 1000
        end_ms = min(end_ms, start_ms + _MAX_BROLL_DURATION_MS)
        clip_id = str(clip.get("_id", clip.get("cue_id", f"legacy_{idx}")))
        clips.append({
            "clip_id": clip_id,
            "start_ms": start_ms,
            "end_ms": end_ms,
        })
    return clips


async def render_with_transitions(
    main_video_path: str,
    broll_clips: list[dict],
    transitions: list[dict],
    output_path: str,
) -> dict:
    """Render final video with xfade transitions applied.

    This is called at export time by the export router.
    Returns dict with ``output_path`` and ``transition_count``.
    """
    if not broll_clips or not transitions:
        # Nothing to do — caller should pass through main video as-is
        return {"output_path": main_video_path, "transition_count": 0}

    filter_complex, input_args = _build_xfade_filter(
        main_video_path, broll_clips, transitions
    )

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"FFmpeg xfade render failed (rc={proc.returncode}): "
            f"{stderr.decode(errors='replace')[-600:]}"
        )

    logger.info(
        "render_with_transitions: exported %s (%d transition(s))",
        output_path, len(transitions),
    )
    return {"output_path": output_path, "transition_count": len(transitions)}


# ─── Groq style picker ────────────────────────────────────────────────────────

async def _pick_transition_style(transcript: str) -> str:
    """Ask Groq to pick the best xfade transition for the content mood."""
    if not transcript.strip():
        return "fade"

    client = get_groq_client()
    prompt = (
        f"Choose the best video transition style for this transcript:\n\n"
        f"\"{transcript[:800]}\"\n\n"
        f"Pick ONE transition name from this list:\n"
        f"{', '.join(sorted(_SUPPORTED_TRANSITIONS))}\n"
        f"Return ONLY the transition name, nothing else."
    )
    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=16,
        )
        style = resp.choices[0].message.content.strip().lower()
        return style if style in _SUPPORTED_TRANSITIONS else "fade"
    except Exception as e:
        logger.warning("_pick_transition_style failed: %s", e)
        return "fade"


# ─── FFmpeg filter builder ────────────────────────────────────────────────────

def _build_xfade_filter(
    main_path: str,
    broll_clips: list[dict],
    transitions: list[dict],
) -> tuple[str, list[str]]:
    """Return ``(filter_complex_str, input_args_list)`` for FFmpeg.

    Builds a sequential xfade chain: main → broll[0] → broll[1] → …
    """
    inputs: list[str] = ["-i", main_path]
    for clip in broll_clips:
        inputs.extend(["-i", clip["video_url"]])

    n = len(broll_clips)
    if n == 0:
        return "[0:v][0:a]copy[outv][outa]", inputs

    style = transitions[0]["type"] if transitions else "fade"
    dur = transitions[0]["duration_s"] if transitions else _DEFAULT_DURATION_S

    parts: list[str] = []
    # Scale all inputs to same resolution
    for i in range(n + 1):
        parts.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
                     f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v{i}]")

    # Chain xfade
    prev_v = "v0"
    prev_a = "0:a"
    offset = 0.0
    for i, clip in enumerate(broll_clips):
        duration_s = float(clip.get("duration", 4))
        offset += duration_s - dur
        out_v = f"xv{i}"
        out_a = f"xa{i}"
        parts.append(
            f"[{prev_v}][v{i+1}]xfade=transition={style}:duration={dur}:offset={offset:.3f}[{out_v}]"
        )
        parts.append(
            f"[{prev_a}][{i+1}:a]acrossfade=d={dur}[{out_a}]"
        )
        prev_v = out_v
        prev_a = out_a
        offset += dur

    parts.append(f"[{prev_v}]copy[outv]")
    parts.append(f"[{prev_a}]acopy[outa]")

    return ";".join(parts), inputs
