from __future__ import annotations

import json
import logging
from typing import Any, Literal, TypedDict

from app.services.groq_service import get_groq_client

logger = logging.getLogger(__name__)

VALID_MOODS = [
    "energetic",
    "dramatic",
    "calm",
    "happy",
    "sad",
    "tense",
    "inspirational",
    "funny",
    "corporate",
    "cinematic",
]

EnergyLevel = Literal["low", "medium", "high"]
PaceLevel = Literal["slow", "medium", "fast"]


class MoodProfile(TypedDict):
    primary_mood: str
    secondary_moods: list[str]
    confidence: float
    energy_level: EnergyLevel
    pace_level: PaceLevel


DEFAULT_MOOD_PROFILE: MoodProfile = {
    "primary_mood": "energetic",
    "secondary_moods": ["inspirational"],
    "confidence": 0.5,
    "energy_level": "medium",
    "pace_level": "medium",
}


def _normalize_mood_payload(payload: dict[str, Any]) -> MoodProfile:
    primary = payload.get("primary_mood", DEFAULT_MOOD_PROFILE["primary_mood"])
    if primary not in VALID_MOODS:
        primary = DEFAULT_MOOD_PROFILE["primary_mood"]

    secondary = payload.get("secondary_moods", [])
    if not isinstance(secondary, list):
        secondary = []
    secondary_clean = [m for m in secondary if isinstance(m, str) and m in VALID_MOODS and m != primary][:3]

    confidence_raw = payload.get("confidence", DEFAULT_MOOD_PROFILE["confidence"])
    try:
        confidence = max(0.0, min(1.0, float(confidence_raw)))
    except Exception:
        confidence = DEFAULT_MOOD_PROFILE["confidence"]

    energy = payload.get("energy_level", DEFAULT_MOOD_PROFILE["energy_level"])
    if energy not in ("low", "medium", "high"):
        energy = DEFAULT_MOOD_PROFILE["energy_level"]

    pace = payload.get("pace_level", DEFAULT_MOOD_PROFILE["pace_level"])
    if pace not in ("slow", "medium", "fast"):
        pace = DEFAULT_MOOD_PROFILE["pace_level"]

    return {
        "primary_mood": primary,
        "secondary_moods": secondary_clean,
        "confidence": round(confidence, 3),
        "energy_level": energy,
        "pace_level": pace,
    }


def _heuristic_profile(cues: list[dict[str, Any]]) -> MoodProfile:
    if not cues:
        return DEFAULT_MOOD_PROFILE.copy()

    duration_ms = max(cues[-1].get("end_ms", 0), 1)
    total_words = 0
    exclamation_count = 0
    question_count = 0
    for cue in cues:
        text = str(cue.get("text", "") or "")
        words = [w for w in text.split() if w.strip()]
        total_words += len(words)
        exclamation_count += text.count("!")
        question_count += text.count("?")

    words_per_sec = total_words / max(duration_ms / 1000, 1)

    if words_per_sec > 3.4 or exclamation_count >= 3:
        primary = "energetic"
        energy: EnergyLevel = "high"
        pace: PaceLevel = "fast"
    elif words_per_sec < 1.5:
        primary = "calm"
        energy = "low"
        pace = "slow"
    else:
        primary = "cinematic" if question_count > 1 else "inspirational"
        energy = "medium"
        pace = "medium"

    secondary = ["inspirational"] if primary != "inspirational" else ["cinematic"]
    return {
        "primary_mood": primary,
        "secondary_moods": secondary,
        "confidence": 0.55,
        "energy_level": energy,
        "pace_level": pace,
    }


async def derive_mood_profile(cues: list[dict[str, Any]]) -> MoodProfile:
    transcript = " ".join(str(c.get("text", "") or "") for c in cues).strip()
    if not transcript:
        return DEFAULT_MOOD_PROFILE.copy()

    prompt = (
        "Analyze transcript tone and pacing from subtitle cues. Return JSON only with:\n"
        "{\n"
        '  "primary_mood": one of ' + json.dumps(VALID_MOODS) + ",\n"
        '  "secondary_moods": array of 0-3 moods from same list,\n'
        '  "confidence": number between 0 and 1,\n'
        '  "energy_level": "low"|"medium"|"high",\n'
        '  "pace_level": "slow"|"medium"|"fast"\n'
        "}\n"
        "No markdown.\n\n"
        f"Transcript:\n{transcript[:3000]}"
    )

    try:
        client = get_groq_client()
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=220,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if "```" in raw:
            raw = raw.split("```")[-2].strip()
        parsed = json.loads(raw)
        return _normalize_mood_payload(parsed if isinstance(parsed, dict) else {})
    except Exception as exc:
        logger.warning("derive_mood_profile fallback to heuristic: %s", exc)
        return _heuristic_profile(cues)


async def build_mood_profile_for_project(project_id: str, db: Any) -> MoodProfile:
    cues = await load_project_cues(project_id, db)
    return await derive_mood_profile(cues)


async def load_project_cues(project_id: str, db: Any) -> list[dict[str, Any]]:
    track = await db.subtitle_tracks.find_one(
        {"project_id": project_id},
        sort=[("is_original", -1), ("created_at", -1)],
    )
    if not track:
        return []

    track_id = str(track.get("_id"))
    cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
    cues: list[dict[str, Any]] = []
    async for cue in cursor:
        cue_id = cue.get("_id")
        cues.append({
            "_id": str(cue_id) if cue_id is not None else "",
            "text": cue.get("text", ""),
            "start_ms": cue.get("start_ms", 0),
            "end_ms": cue.get("end_ms", 0),
            "sequence": cue.get("sequence", 0),
        })
    return cues
