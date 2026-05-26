"""Cloudinary-only music suggestion service with mood-aware scoring."""
from __future__ import annotations

import logging
from typing import Any

from app.services.cloudinary_service import search_assets_by_tag
from app.services.mood_service import MoodProfile, build_mood_profile_for_project, load_project_cues

logger = logging.getLogger(__name__)


ENERGY_HINTS: dict[str, tuple[str, ...]] = {
    "high": ("energetic", "dramatic", "epic", "upbeat", "intense"),
    "medium": ("cinematic", "inspirational", "corporate", "ambient"),
    "low": ("calm", "soft", "ambient", "mellow"),
}

PACE_HINTS: dict[str, tuple[str, ...]] = {
    "fast": ("fast", "driving", "punchy", "upbeat"),
    "medium": ("steady", "rhythmic", "cinematic"),
    "slow": ("slow", "ambient", "soft", "calm"),
}


def _compute_music_score(
    track: dict,
    moods: list[str],
    energy_level: str,
    pace_level: str,
) -> tuple[float, list[str], str]:
    tags = [str(t).lower() for t in (track.get("tags") or []) if isinstance(t, str)]
    matched_tags = [m for m in moods if m in tags]
    overlap = len(matched_tags) / max(1, len(moods))
    duration = float(track.get("duration") or 0)
    energy_overlap = len([tag for tag in ENERGY_HINTS.get(energy_level, ()) if tag in tags]) / max(
        1, len(ENERGY_HINTS.get(energy_level, ()))
    )
    pace_overlap = len([tag for tag in PACE_HINTS.get(pace_level, ()) if tag in tags]) / max(
        1, len(PACE_HINTS.get(pace_level, ()))
    )
    has_preview = 1.0 if track.get("file_url") else 0.0

    duration_score = min(1.0, duration / 60.0) if duration > 0 else 0.4

    score = max(
        0.0,
        min(
            1.0,
            0.46 * overlap
            + 0.22 * duration_score
            + 0.16 * energy_overlap
            + 0.1 * pace_overlap
            + 0.06 * has_preview,
        ),
    )
    reason = (
        f"Matched mood tags {matched_tags}" if matched_tags else "Selected by fallback ranking from Cloudinary music library"
    )
    return round(score, 3), matched_tags, reason


def _recommend_music_timeline(
    track_duration_s: float,
    video_duration_ms: int,
    energy_level: str,
) -> dict[str, int]:
    clip_start_ms = 0
    target_duration_ms = max(1000, int(video_duration_ms))
    track_duration_ms = int(max(0.0, track_duration_s) * 1000)
    if track_duration_ms <= 0:
        track_duration_ms = target_duration_ms

    trim_start_ms = 0
    if track_duration_ms > target_duration_ms + 2500:
        # Skip long intros for faster-paced timelines.
        trim_factor = {"high": 0.18, "medium": 0.1, "low": 0.04}.get(energy_level, 0.1)
        trim_start_ms = int((track_duration_ms - target_duration_ms) * trim_factor)
        trim_start_ms = max(0, min(trim_start_ms, track_duration_ms - 1000))

    available_ms = max(1000, track_duration_ms - trim_start_ms)
    play_ms = min(target_duration_ms, available_ms)
    return {
        "timeline_start_ms": clip_start_ms,
        "timeline_end_ms": clip_start_ms + play_ms,
        "trim_start_ms": trim_start_ms,
        "trim_end_ms": trim_start_ms + play_ms,
    }


async def find_music_for_project(
    project_id: str,
    db: Any,
    mood_profile: MoodProfile | None = None,
) -> dict:
    cues = await load_project_cues(project_id, db)
    video_duration_ms = max((int(c.get("end_ms", 0)) for c in cues), default=60000)
    profile = mood_profile or await build_mood_profile_for_project(project_id, db)
    mood_tags = [profile["primary_mood"], *profile["secondary_moods"]]

    tracks = await search_assets_by_tag(folder="music", tags=mood_tags, limit=20)
    if not tracks:
        return {
            "suggestions": [],
            "empty_reason": "No Cloudinary music assets found for derived mood tags",
        }

    ranked: list[dict] = []
    for t in tracks:
        if not t.get("file_url"):
            continue
        score, matched_tags, reason = _compute_music_score(
            t,
            mood_tags,
            profile["energy_level"],
            profile["pace_level"],
        )
        timeline = _recommend_music_timeline(
            track_duration_s=float(t.get("duration", 0) or 0),
            video_duration_ms=video_duration_ms,
            energy_level=profile["energy_level"],
        )
        ranked.append({
            "id": t.get("name") or "",
            "name": t.get("name", "Untitled Track"),
            "preview_url": t.get("file_url"),
            "duration": t.get("duration", 0),
            "tags": t.get("tags", []),
            "score": score,
            "matched_tags": matched_tags,
            "source": "cloudinary",
            "reason": reason,
            **timeline,
        })

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return {"suggestions": ranked[:8], "empty_reason": None}
