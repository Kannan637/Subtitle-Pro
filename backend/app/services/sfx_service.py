"""Cloudinary-only SFX suggestion service with adaptive cue placement."""
from __future__ import annotations

import logging
import re
from typing import Any

from app.services.cloudinary_service import search_assets_by_tag
from app.services.mood_service import MoodProfile, build_mood_profile_for_project, load_project_cues

logger = logging.getLogger(__name__)

SFX_STOPWORDS = {
    "the", "and", "or", "to", "for", "with", "that", "this", "you", "your", "they",
    "have", "has", "are", "was", "were", "from", "into", "about", "when", "where",
    "what", "will", "just", "there", "their", "them", "then", "than", "very", "really",
}


def _cue_intensity(cue: dict, pace_level: str) -> float:
    text = str(cue.get("text", "") or "")
    duration_ms = max(1, int(cue.get("end_ms", 0)) - int(cue.get("start_ms", 0)))
    word_count = len([w for w in text.split() if w.strip()])
    words_per_sec = word_count / max(duration_ms / 1000, 0.1)
    punctuation_boost = text.count("!") * 0.12 + text.count("?") * 0.05
    pace_boost = {"slow": -0.08, "medium": 0.0, "fast": 0.12}.get(pace_level, 0.0)
    return max(0.0, min(1.0, 0.24 * words_per_sec + punctuation_boost + pace_boost))


def _cue_keywords(text: str) -> list[str]:
    tokens = [
        t.lower()
        for t in re.findall(r"[A-Za-z0-9']+", text or "")
        if len(t) >= 4 and t.lower() not in SFX_STOPWORDS
    ]
    seen: set[str] = set()
    deduped: list[str] = []
    for token in tokens:
        if token not in seen:
            seen.add(token)
            deduped.append(token)
    return deduped[:6]


def _compute_sfx_score(asset: dict, moods: list[str], cue_score: float, cue_tokens: list[str]) -> tuple[float, list[str], str]:
    tags = [str(t).lower() for t in (asset.get("tags") or []) if isinstance(t, str)]
    matched_tags = [m for m in moods if m in tags]
    overlap = len(matched_tags) / max(1, len(moods))
    lexical_overlap = len([token for token in cue_tokens if token in tags]) / max(1, len(cue_tokens))
    duration_s = float(asset.get("duration") or 0)
    duration_bias = 1.0 if 0 < duration_s <= 2.2 else 0.78 if duration_s <= 4.0 else 0.62
    score = max(0.0, min(1.0, 0.44 * overlap + 0.34 * cue_score + 0.16 * lexical_overlap + 0.06 * duration_bias))
    reason = (
        f"Matched tags {matched_tags} with cue intensity {cue_score:.2f}"
        if matched_tags
        else f"Placed by adaptive cue intensity {cue_score:.2f}"
    )
    return round(score, 3), matched_tags, reason


def _adaptive_place_sfx(cues: list[dict], assets: list[dict], profile: MoodProfile) -> list[dict]:
    if not cues or not assets:
        return []

    mood_tags = [profile["primary_mood"], *profile["secondary_moods"]]
    min_gap_ms = {"low": 4500, "medium": 3000, "high": 1800}[profile["energy_level"]]
    threshold = {"slow": 0.38, "medium": 0.31, "fast": 0.26}[profile["pace_level"]]
    max_sfx_window_ms = 2200

    placements: list[dict] = []
    last_start = -10**9
    used_assets: set[str] = set()
    for cue in cues:
        start_ms = int(cue.get("start_ms", 0))
        end_ms = int(cue.get("end_ms", start_ms))
        if start_ms - last_start < min_gap_ms:
            continue
        if end_ms <= start_ms:
            continue

        intensity = _cue_intensity(cue, profile["pace_level"])
        if intensity < threshold:
            continue

        cue_text = str(cue.get("text", "") or "")
        cue_tokens = _cue_keywords(cue_text)
        ranked_assets = sorted(
            assets,
            key=lambda asset: _compute_sfx_score(asset, mood_tags, intensity, cue_tokens)[0],
            reverse=True,
        )
        asset = next((a for a in ranked_assets if str(a.get("name")) not in used_assets), ranked_assets[0])
        used_assets.add(str(asset.get("name")))

        score, matched_tags, reason = _compute_sfx_score(asset, mood_tags, intensity, cue_tokens)
        cue_window_ms = end_ms - start_ms
        anchor_ms = start_ms + int(min(280, cue_window_ms * 0.12))
        asset_duration_ms = int(max(0.0, float(asset.get("duration") or 0)) * 1000)
        if asset_duration_ms <= 0:
            asset_duration_ms = min(max_sfx_window_ms, cue_window_ms)
        place_duration_ms = min(max_sfx_window_ms, cue_window_ms, asset_duration_ms)
        if place_duration_ms <= 0:
            continue
        place_end_ms = min(end_ms, anchor_ms + place_duration_ms)
        if place_end_ms <= anchor_ms:
            continue

        placements.append({
            "cue_id": str(cue.get("_id") or cue.get("id") or f"cue-{len(placements)}"),
            "cue_text": cue_text[:80],
            "start_ms": anchor_ms,
            "end_ms": place_end_ms,
            "trim_start_ms": 0,
            "trim_end_ms": place_end_ms - anchor_ms,
            "score": score,
            "matched_tags": matched_tags,
            "placement_reason": reason,
            "source": "cloudinary",
            "sfx": {
                "name": asset.get("name", "Untitled SFX"),
                "file_url": asset.get("file_url", ""),
                "mood": asset.get("tags", []),
                "duration": max(0.1, (place_end_ms - anchor_ms) / 1000.0),
            },
        })
        last_start = anchor_ms

    return placements


async def suggest_sfx(
    project_id: str,
    db: Any,
    mood_profile: MoodProfile | None = None,
) -> dict:
    cues = await load_project_cues(project_id, db)
    if not cues:
        logger.warning("sfx_service: no subtitle cues for project %s", project_id)
        return {"suggestions": [], "empty_reason": "No subtitle cues found"}

    profile = mood_profile or await build_mood_profile_for_project(project_id, db)
    mood_tags = [profile["primary_mood"], *profile["secondary_moods"]]
    assets = await search_assets_by_tag(folder="sfx", tags=mood_tags, limit=25)
    if not assets:
        return {
            "suggestions": [],
            "empty_reason": "No Cloudinary SFX assets found for derived mood tags",
        }

    suggestions = _adaptive_place_sfx(cues, assets, profile)
    if not suggestions:
        return {
            "suggestions": [],
            "empty_reason": "No eligible cue windows after adaptive spacing/intensity guards",
        }
    return {"suggestions": suggestions, "empty_reason": None}
