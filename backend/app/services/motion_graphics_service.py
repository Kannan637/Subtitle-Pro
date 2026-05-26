"""AI motion graphics service for cue-driven animated callouts.

The full external renderer described in the blueprint can be added later as a
sidecar renderer. This service keeps the production path deterministic: Groq
selects moments/design direction when available, and a local heuristic fallback
returns usable motion graphic overlays without blocking export.
"""
from __future__ import annotations

import html
import json
import logging
import re
from typing import Any, Dict, List

import requests

from app.core.config import settings
from app.services.groq_service import get_groq_client

logger = logging.getLogger(__name__)

PEXELS_PHOTO_URL = "https://api.pexels.com/v1/search"
MAX_MOTION_DURATION_MS = 3000
MIN_MOTION_DURATION_MS = 500
DEFAULT_DENSITY = 0.35
DEFAULT_MAX_ITEMS = 12
MOTION_THEME_ACCENT = "#7E22CE"
MOTION_THEME_BACKGROUND = "#FFFFFF"
MOTION_THEME_TINT = "#F5F3FF"
MOTION_THEME_PANEL = "rgba(245,243,255,0.92)"
MOTION_THEME_PANEL_STRONG = "rgba(255,255,255,0.94)"

MOTION_GRAPHICS_SYSTEM_PROMPT = """
You are a world-class Motion Graphic Designer, Cinematic Video Editor, and Visual Storytelling Director specializing in modern high-retention digital content, premium brand films, commercials, social media campaigns, fashion edits, cinematic reels, UI motion systems, and viral short-form videos.

Your role is to create visually striking, emotionally engaging, and highly polished motion graphics integrated seamlessly with video editing. Every animation, transition, and visual effect must serve storytelling, attention control, pacing, emotional impact, and viewer retention.

Your creative direction combines cinematic storytelling, modern motion design systems, editorial aesthetics, premium compositing, rhythm-based editing, high-end commercial visuals, and social-first engagement psychology.

Creative philosophy:
Motion graphics should never feel random or overdesigned. Every movement must have intention, hierarchy, rhythm, and emotional purpose. The work should feel immersive, premium, modern, and culturally relevant.

Core visual style:
- cinematic and modern
- bold but clean
- minimal yet expressive
- emotionally immersive
- visually layered
- rhythm-driven
- editorial-inspired
- high contrast
- premium digital aesthetics
- youth-culture aware
- trend-forward but timeless

Motion graphic direction:
- use one coherent color theme across the full video: white/near-white stages, black typography, and restrained purple accents
- do not repeat the same motion graphic design through the entire video; vary layout, style, placement, and animation by moment type while keeping the same color theme
- use a premium editorial poster stage only when it is the best storytelling fit: solid white background, faint grid, oversized low-opacity ghost typography, a relevant central visual/object, black typography with selective purple editorial serif accents, and per-word opacity reveals synchronized to the spoken phrase
- kinetic typography
- cinematic transitions
- dynamic camera movement
- smooth motion systems
- layered compositing
- motion blur
- depth-based animation
- UI-inspired overlays
- particle atmospherics only when purposeful
- shape-based transitions
- animated masks
- parallax motion
- advanced lighting effects
- editorial layouts in motion
- subtle grain and texture overlays

Typography principles:
- strong visual hierarchy
- oversized but readable headlines
- modern sans-serif typography
- aggressive and readable motion
- black editorial title text on white stages when using image-led motion graphics, with only the most meaningful words switching to purple italic serif emphasis
- word emphasis animation
- staggered reveals
- mask reveals
- blur transitions
- stretch and scale animations
- typography synchronized with rhythm, speech, or music

Editing principles:
- retention-focused pacing
- emotional timing
- cinematic sequencing
- rhythm-based cuts
- visually evolving scenes every few seconds
- intentional transitions
- premium compositing
- immersive visual flow
- balanced energy and readability
- controlled use of effects
- smooth continuity between shots
- visual variety across the timeline without changing the brand palette

Animation principles:
- natural easing
- anticipation and overshoot
- secondary motion
- realistic movement physics
- visual weight and momentum
- motion blur integration
- layered depth and environmental realism

Visual storytelling rules:
- guide viewer attention intentionally
- maintain strong focal hierarchy
- create emotional progression
- blend graphics naturally into footage
- enhance narrative instead of distracting from it
- use motion to amplify emotion, tension, hype, elegance, or energy depending on context

Sound integration:
Motion should feel connected to audio through impact synchronization, whooshes, risers, bass hits, ambient textures, cinematic sound transitions, and rhythm-based animation timing.

Platform awareness:
Optimize visual language for short-form vertical content, cinematic widescreen edits, advertisements, documentaries, music videos, luxury brand campaigns, UI/product showcases, social media reels, fashion films, tech promos, and creator content.

2026 quality standard:
- cinematic realism
- minimal premium motion
- high-end typography systems
- UI-inspired animation
- invisible transitions
- emotionally driven pacing
- layered micro-interactions
- realistic camera movement
- editorial fashion-film influence
- hybrid 2D/3D compositing
- modern digital texture systems
- immersive depth and atmosphere

Avoid outdated gaming-style effects, excessive transitions, random animations, cluttered compositions, overused presets, distracting visual noise, poor hierarchy, and motion without purpose.

Every scene should feel intentional, emotionally engaging, visually premium, and professionally directed. Return only production-safe decisions that can be executed by the current motion graphics renderer.
""".strip()

STOP_WORDS = {
    "about", "after", "again", "also", "because", "before", "being", "between",
    "could", "every", "from", "have", "into", "just", "like", "more", "most",
    "over", "really", "should", "some", "that", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "when", "where", "with", "would",
    "your", "youre", "were", "what", "will", "very", "than", "only", "dont",
}

POWER_TERMS = {
    "secret", "mistake", "growth", "money", "revenue", "profit", "viral",
    "important", "biggest", "never", "always", "best", "worst", "hack",
    "strategy", "system", "result", "results", "proof", "problem", "solution",
    "warning", "risk", "million", "thousand", "percent", "launch", "sales",
}

EMOTION_TERMS = {
    "afraid", "angry", "anxiety", "believe", "breakthrough", "changed",
    "crazy", "dream", "excited", "fear", "feel", "felt", "happy", "hate",
    "hope", "hurt", "insane", "love", "panic", "pain", "proud", "sad",
    "scared", "shock", "shocked", "surprise", "surprised", "trust",
}

CTA_TERMS = {
    "book", "buy", "click", "comment", "demo", "download", "follow", "join",
    "learn", "like", "save", "share", "start", "subscribe", "try", "watch",
}

TECH_TERMS = {
    "agent", "ai", "app", "automation", "data", "dashboard", "editor",
    "model", "prompt", "software", "startup", "system", "tool", "workflow",
}

HYPE_TERMS = {
    "attention", "breakthrough", "fast", "huge", "insane", "massive",
    "replace", "replaced", "replacing", "secret", "viral",
}

MOMENT_TYPES = {"hook", "explanation", "emotion", "transition", "cta"}
STYLE_FAMILIES = {"cinematic_creator", "ui_motion", "kinetic_typography", "hyper_dynamic"}
MOTION_ROLES = {"primary", "secondary", "ambient"}
MOTION_STYLES = {
    "editorial_image_text",
    "kinetic_focus",
    "stat_pulse",
    "alert_snap",
    "clean_callout",
    "ui_tracker",
    "cinematic_caption",
    "clean_cta",
}


def _normalize_text(value: str) -> str:
    return " ".join(re.findall(r"[A-Za-z0-9']+", (value or "").lower()))


def _cue_id(cue: Dict[str, Any], index: int) -> str:
    return str(cue.get("_id") or cue.get("cue_id") or cue.get("id") or f"cue_{index}")


def _bounded_window(start_ms: int, end_ms: int) -> tuple[int, int]:
    start = max(0, int(start_ms or 0))
    requested_end = int(end_ms or start)
    if requested_end <= start:
        requested_end = start + MIN_MOTION_DURATION_MS
    capped_end = min(requested_end, start + MAX_MOTION_DURATION_MS)
    if capped_end - start < MIN_MOTION_DURATION_MS:
        capped_end = start + MIN_MOTION_DURATION_MS
    return start, max(start + 1, capped_end)


def merge_cues_into_motion_blocks(cues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge short caption cues into motion-graphic-friendly windows."""
    blocks: List[Dict[str, Any]] = []
    current: Dict[str, Any] | None = None

    for index, cue in enumerate(cues):
        text = str(cue.get("text", "") or "").strip()
        if not text:
            continue
        start_ms = int(cue.get("start_ms", 0) or 0)
        end_ms = int(cue.get("end_ms", start_ms) or start_ms)
        words = cue.get("words") if isinstance(cue.get("words"), list) else []

        if current is None:
            current = {
                "cue_id": _cue_id(cue, index),
                "text": text,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "segments": [{"text": text, "start_ms": start_ms, "end_ms": end_ms, "words": words}],
            }
            continue

        gap_ms = start_ms - int(current["end_ms"])
        duration_ms = int(current["end_ms"]) - int(current["start_ms"])
        hard_stop = str(current["text"]).strip().endswith((".", "!", "?"))
        if gap_ms > 700 or duration_ms >= MAX_MOTION_DURATION_MS or (hard_stop and duration_ms >= 1200):
            blocks.append(current)
            current = {
                "cue_id": _cue_id(cue, index),
                "text": text,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "segments": [{"text": text, "start_ms": start_ms, "end_ms": end_ms, "words": words}],
            }
        else:
            current["text"] = f"{current['text']} {text}".strip()
            current["end_ms"] = end_ms
            current.setdefault("segments", []).append({"text": text, "start_ms": start_ms, "end_ms": end_ms, "words": words})

    if current:
        blocks.append(current)
    return blocks


def _keyword_from_text(text: str) -> str:
    normalized = _normalize_text(text)
    tokens = [
        token for token in normalized.split()
        if len(token) >= 4 and token not in STOP_WORDS
    ]
    if not tokens:
        return "Key moment"

    numbers = [token for token in tokens if any(ch.isdigit() for ch in token)]
    power = [token for token in tokens if token in POWER_TERMS]
    selected: list[str] = []
    for token in numbers + power + tokens:
        if token not in selected:
            selected.append(token)
        if len(selected) >= 3:
            break
    return " ".join(selected).title()


def _display_text(text: str, keyword: str) -> str:
    number_match = re.search(r"\b(?:\d+[,.]?\d*|\d+%|\$[0-9,.]+)\b", text)
    if number_match:
        return number_match.group(0)
    words = keyword.strip().split()
    if not words:
        return "Key Moment"
    return " ".join(words[:4])


def _heuristic_importance(text: str) -> float:
    normalized = _normalize_text(text)
    words = normalized.split()
    score = 0.22
    if any(ch.isdigit() for ch in text):
        score += 0.2
    if any(term in normalized for term in POWER_TERMS):
        score += 0.22
    if re.search(r"[!?]", text):
        score += 0.08
    if 5 <= len(words) <= 22:
        score += 0.12
    if len(words) > 22:
        score -= 0.08
    if normalized.startswith(("so ", "and ", "but ", "um ", "uh ")):
        score -= 0.12
    return max(0.0, min(1.0, score))


def _contains_any(normalized_text: str, terms: set[str]) -> bool:
    haystack = f" {normalized_text} "
    return any(f" {term} " in haystack for term in terms)


def _moment_type_for_block(text: str, start_ms: int, index: int, total_blocks: int) -> str:
    normalized = _normalize_text(text)
    if start_ms <= 3200 or index == 0:
        return "hook"
    if index >= max(0, total_blocks - 2) and _contains_any(normalized, CTA_TERMS):
        return "cta"
    if _contains_any(normalized, EMOTION_TERMS):
        return "emotion"
    if re.search(r"\b(first|second|third|next|then|finally|but|however|instead|because)\b", normalized):
        return "transition"
    return "explanation"


def _style_family_for_text(text: str, moment_type: str, importance: float) -> str:
    normalized = _normalize_text(text)
    if moment_type == "emotion":
        return "cinematic_creator"
    if _contains_any(normalized, TECH_TERMS):
        return "ui_motion"
    if importance >= 0.86 and (moment_type == "hook" or _contains_any(normalized, HYPE_TERMS)):
        return "hyper_dynamic"
    if moment_type == "hook" or _contains_any(normalized, HYPE_TERMS):
        return "kinetic_typography"
    return "cinematic_creator"


def _motion_role(moment_type: str, importance: float) -> str:
    if moment_type == "hook" or importance >= 0.82:
        return "primary"
    if moment_type in {"emotion", "cta"} or importance >= 0.58:
        return "secondary"
    return "ambient"


def _motion_principle(moment_type: str, style_family: str, motion_role: str) -> str:
    if moment_type == "emotion":
        return "slow_ease_soft_depth"
    if moment_type == "transition":
        return "directional_ease_motion_blur"
    if moment_type == "cta":
        return "clean_fade_ease_out"
    if style_family == "hyper_dynamic":
        return "anticipation_overshoot_impact"
    if motion_role == "primary":
        return "ease_out_overshoot"
    return "subtle_slide_ease"


def _sound_cue(style_family: str, moment_type: str, text: str) -> str:
    normalized = _normalize_text(text)
    if moment_type == "emotion":
        return "soft_hit"
    if moment_type == "transition":
        return "whoosh"
    if moment_type == "cta":
        return "clean_click"
    if style_family == "ui_motion":
        return "digital_click"
    if style_family == "hyper_dynamic" or _contains_any(normalized, {"warning", "risk", "mistake", "worst"}):
        return "impact"
    return "soft_whoosh"


def _important_words(text: str, keyword: str, display_text: str) -> list[str]:
    candidates: list[str] = []

    for match in re.findall(r"\$?\d[\d,]*(?:\.\d+)?%?|\b\d+x\b", text or "", re.IGNORECASE):
        candidates.append(match)

    source = f"{display_text} {keyword} {text}"
    for token in re.findall(r"[A-Za-z0-9']+", source):
        normalized = token.strip("'").lower()
        if len(normalized) < 3 or normalized in STOP_WORDS:
            continue
        is_power = (
            normalized in POWER_TERMS
            or normalized in HYPE_TERMS
            or normalized in TECH_TERMS
            or normalized in EMOTION_TERMS
        )
        if is_power or any(ch.isdigit() for ch in token) or token.isupper() or len(normalized) >= 7:
            candidates.append(token)

    selected: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        normalized = _normalize_text(candidate)
        if not normalized or normalized in seen:
            continue
        selected.append(candidate[:28])
        seen.add(normalized)
        if len(selected) >= 3:
            break
    return selected


def _timing_terms(important_words: list[str], keyword: str, display_text: str) -> set[str]:
    terms: set[str] = set()
    for source in [*important_words, keyword, display_text]:
        for token in re.findall(r"[A-Za-z0-9']+", str(source or "")):
            normalized = token.strip("'").lower()
            if len(normalized) >= 3 and normalized not in STOP_WORDS:
                terms.add(normalized)
    return terms


def _word_ms(item: Dict[str, Any], ms_key: str, seconds_key: str) -> int | None:
    if item.get(ms_key) is not None:
        try:
            return int(round(float(item.get(ms_key))))
        except Exception:
            return None
    if item.get(seconds_key) is not None:
        try:
            return int(round(float(item.get(seconds_key)) * 1000))
        except Exception:
            return None
    return None


def _estimated_term_window(segment: Dict[str, Any], terms: set[str]) -> tuple[int, int] | None:
    text = str(segment.get("text", "") or "")
    if not text or not terms:
        return None

    timed_words = segment.get("words")
    if isinstance(timed_words, list) and timed_words:
        word_windows: list[tuple[int, int]] = []
        for item in timed_words:
            if not isinstance(item, dict):
                continue
            token = str(item.get("word") or item.get("text") or "").strip()
            if not token or token.strip("'").lower() not in terms:
                continue
            word_start = _word_ms(item, "start_ms", "start")
            word_end = _word_ms(item, "end_ms", "end")
            if word_start is None:
                continue
            if word_end is None or word_end <= word_start:
                word_end = word_start + max(110, min(420, len(token) * 55))
            word_windows.append((word_start, word_end))
        if word_windows:
            return min(start for start, _ in word_windows), max(end for _, end in word_windows)

    matches = list(re.finditer(r"[A-Za-z0-9']+", text))
    if not matches:
        return None

    matched_indices = [
        idx
        for idx, match in enumerate(matches)
        if match.group(0).strip("'").lower() in terms
    ]
    if not matched_indices:
        return None

    segment_start = int(segment.get("start_ms", 0) or 0)
    segment_end = int(segment.get("end_ms", segment_start) or segment_start)
    if segment_end <= segment_start:
        segment_end = segment_start + MIN_MOTION_DURATION_MS

    token_duration = (segment_end - segment_start) / max(1, len(matches))
    first_idx = min(matched_indices)
    last_idx = max(matched_indices)
    estimated_start = segment_start + int(max(0.0, first_idx - 0.25) * token_duration)
    estimated_end = segment_start + int(min(float(len(matches)), last_idx + 1.25) * token_duration)
    return estimated_start, max(estimated_start + 1, estimated_end)


def _motion_window_for_block(
    block: Dict[str, Any],
    important_words: list[str],
    keyword: str,
    display_text: str,
    moment_type: str,
) -> tuple[int, int]:
    """Align motion to the spoken important word where cue timing allows it."""
    block_start = int(block.get("start_ms", 0) or 0)
    block_end = int(block.get("end_ms", block_start) or block_start)
    terms = _timing_terms(important_words, keyword, display_text)
    windows: list[tuple[int, int]] = []

    for segment in block.get("segments") or []:
        estimated = _estimated_term_window(segment, terms)
        if estimated:
            windows.append(estimated)

    if not windows:
        return _bounded_window(block_start, block_end)

    spoken_start = min(start for start, _ in windows)
    spoken_end = max(end for _, end in windows)
    lead_ms = 80 if moment_type in {"hook", "transition"} else 50
    release_ms = 460 if moment_type in {"hook", "explanation"} else 320
    max_duration = 1800 if moment_type in {"hook", "explanation"} else 1500

    start = max(0, spoken_start - lead_ms)
    end = spoken_end + release_ms
    if end - start > max_duration:
        end = start + max_duration
    if end < spoken_end + 160:
        end = spoken_end + 160
        if end - start > MAX_MOTION_DURATION_MS:
            start = max(0, end - MAX_MOTION_DURATION_MS)

    return _bounded_window(start, end)


def _editing_note(moment_type: str, style_family: str, motion_role: str, sound_cue: str) -> str:
    if moment_type == "hook":
        return "Hook moment: use one confident primary motion to stop the scroll."
    if moment_type == "emotion":
        return "Emotional beat: keep movement soft and cinematic so it does not fight the line."
    if moment_type == "transition":
        return "Pacing beat: use directional motion to bridge the next idea cleanly."
    if moment_type == "cta":
        return "Ending beat: keep the CTA clean, readable, and sound-supported."
    if style_family == "ui_motion":
        return "Explanation beat: add a clean UI-style accent that guides the eye."
    if motion_role == "ambient":
        return "Light supporting beat: subtle movement only, no heavy effect."
    return f"Explanation beat: pair typography with a {sound_cue.replace('_', ' ')} cue."


def _safe_choice(value: Any, allowed: set[str], fallback: str) -> str:
    candidate = str(value or "").strip()
    return candidate if candidate in allowed else fallback


def _pexels_photo_query(keyword: str, display_text: str, source_text: str) -> str:
    candidate = " ".join(part for part in [keyword, display_text] if str(part or "").strip()).strip()
    if candidate:
        return candidate[:80]
    tokens = [
        token for token in _normalize_text(source_text).split()
        if len(token) >= 4 and token not in STOP_WORDS
    ]
    return " ".join(tokens[:4]) or "modern editorial"


def fetch_pexels_photo(keyword: str) -> Dict[str, Any] | None:
    api_key = settings.pexels_api_key
    query = str(keyword or "").strip()
    if not api_key or not query:
        return None

    try:
        response = requests.get(
            PEXELS_PHOTO_URL,
            headers={"Authorization": api_key},
            params={"query": query, "orientation": "landscape", "per_page": 8},
            timeout=8,
        )
        if not response.ok:
            logger.warning("Pexels photo API error %s for '%s': %s", response.status_code, query, response.text[:180])
            return None
        data = response.json()
        photos = data.get("photos") or []
        if not photos:
            return None
        photo = photos[0]
        src = photo.get("src") or {}
        image_url = src.get("large") or src.get("medium") or src.get("landscape") or src.get("original")
        if not image_url:
            return None
        return {
            "image_url": image_url,
            "image_alt": str(photo.get("alt") or query),
            "image_pexels_id": str(photo.get("id", "")),
            "image_credit": str((photo.get("photographer") or "")).strip(),
            "image_query": query,
        }
    except Exception as exc:
        logger.warning("Pexels photo fetch failed for '%s': %s", query, exc)
        return None


def _style_design(style: str, index: int, moment_type: str = "explanation") -> Dict[str, str]:
    """Map every renderer-safe style to one shared video color theme."""
    placements = ["lower_third", "center", "top_right", "top_left"]
    fallback_placement = placements[index % len(placements)]
    mapping: Dict[str, Dict[str, str]] = {
        "editorial_image_text": {
            "shape": "editorial-poster-object",
            "animation": "word-opacity",
            "placement": "center",
            "background": "transparent",
            "solid_background": MOTION_THEME_BACKGROUND,
        },
        "kinetic_focus": {
            "shape": "orbital-rings",
            "animation": "word-stagger",
            "placement": "center",
            "background": MOTION_THEME_PANEL,
            "solid_background": MOTION_THEME_TINT,
        },
        "stat_pulse": {
            "shape": "metric-pill",
            "animation": "scale-pop",
            "placement": "lower_third",
            "background": MOTION_THEME_PANEL_STRONG,
            "solid_background": MOTION_THEME_BACKGROUND,
        },
        "alert_snap": {
            "shape": "warning-card",
            "animation": "snap-in",
            "placement": "center",
            "background": MOTION_THEME_PANEL_STRONG,
            "solid_background": MOTION_THEME_BACKGROUND,
        },
        "clean_callout": {
            "shape": "soft-panel",
            "animation": "slide-rise",
            "placement": fallback_placement,
            "background": MOTION_THEME_PANEL,
            "solid_background": MOTION_THEME_TINT,
        },
        "ui_tracker": {
            "shape": "tracking-panel",
            "animation": "slide-mask",
            "placement": "top_right" if index % 2 == 0 else "top_left",
            "background": MOTION_THEME_PANEL,
            "solid_background": MOTION_THEME_TINT,
        },
        "cinematic_caption": {
            "shape": "minimal-title",
            "animation": "soft-drift",
            "placement": "center",
            "background": "rgba(255,255,255,0.86)",
            "solid_background": MOTION_THEME_BACKGROUND,
        },
        "clean_cta": {
            "shape": "cta-strip",
            "animation": "fade-rise",
            "placement": "lower_third",
            "background": MOTION_THEME_PANEL_STRONG,
            "solid_background": MOTION_THEME_BACKGROUND,
        },
    }
    safe_style = style if style in mapping else "clean_callout"
    design = {
        "style": safe_style,
        "accent_color": MOTION_THEME_ACCENT,
        **mapping[safe_style],
    }
    if moment_type == "hook" and safe_style == "clean_callout":
        design["animation"] = "word-stagger"
        design["placement"] = "center"
    return design


def _design_for_text(text: str, index: int, moment_type: str, style_family: str) -> Dict[str, str]:
    normalized = _normalize_text(text)

    if moment_type == "cta":
        return _style_design("clean_cta", index, moment_type)
    if moment_type == "emotion":
        return _style_design("cinematic_caption", index, moment_type)
    if any(term in normalized for term in ("money", "revenue", "profit", "sales", "growth", "percent")):
        return _style_design("stat_pulse", index, moment_type)
    if any(term in normalized for term in ("warning", "risk", "mistake", "problem", "worst", "fail")):
        return _style_design("alert_snap", index, moment_type)
    if style_family == "ui_motion":
        return _style_design("ui_tracker", index, moment_type)
    if style_family in {"kinetic_typography", "hyper_dynamic"} or any(term in normalized for term in ("secret", "idea", "innovation", "strategy", "system", "viral")):
        return _style_design("kinetic_focus", index, moment_type)

    hook_cycle = ["kinetic_focus", "editorial_image_text", "ui_tracker", "clean_callout"]
    explainer_cycle = ["clean_callout", "ui_tracker", "editorial_image_text", "kinetic_focus", "cinematic_caption"]
    cycle = hook_cycle if moment_type == "hook" else explainer_cycle
    return _style_design(cycle[index % len(cycle)], index, moment_type)


def _parse_groq_json(raw: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        candidate = raw.strip()
        if "```" in candidate:
            candidate = candidate.split("```json")[-1].split("```")[0].strip()
            if not candidate.startswith("["):
                candidate = raw.split("```")[-2].strip()
        parsed = json.loads(candidate)
    return parsed if isinstance(parsed, list) else []


def _groq_motion_analysis(blocks: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Ask Groq to pick motion graphic worthy moments. Safe to fail."""
    if not blocks:
        return {}
    try:
        client = get_groq_client()
    except Exception as exc:
        logger.info("Groq motion analysis unavailable; using heuristic fallback: %s", exc)
        return {}

    indexed = [
        {
            "i": index,
            "text": str(block.get("text", ""))[:260],
            "start_ms": int(block.get("start_ms", 0) or 0),
            "end_ms": int(block.get("end_ms", 0) or 0),
        }
        for index, block in enumerate(blocks)
    ]
    prompt = (
        "Select subtitle moments that deserve a 1-3 second animated graphic callout.\n"
        "Apply the system creative direction, but stay inside the renderer-safe style set.\n"
        "Selection rules:\n"
        "- Hook 0-3s gets the strongest clean typography or UI motion.\n"
        "- Explanation lines should guide the eye with stats, arrows, UI panels, or highlight boxes.\n"
        "- Emotional lines need soft cinematic motion, not loud effects.\n"
        "- Transitions should be motivated and directional, never random presets.\n"
        "- CTA moments should be clean, readable, and elegant.\n"
        "- Keep the same brand palette across every motion graphic: white/near-white, black text, purple accent.\n"
        "- Do not choose the same style repeatedly. Rotate between kinetic_focus, clean_callout, ui_tracker, cinematic_caption, stat_pulse, alert_snap, clean_cta, and occasional editorial_image_text.\n"
        "- Use editorial_image_text only for selected image-led explainer moments: editorial poster look, white stage, faint grid, central related image/object, ghost typography, black title text, selective purple editorial serif emphasis, word-opacity reveal.\n"
        "- Animate only important words, not the full sentence.\n"
        "- Choose advanced visuals with purpose: HUD, kinetic typography, stat systems, alert slashes, cinematic light, or CTA dock.\n"
        "- Pair each motion with a realistic supporting sound cue.\n"
        "Prioritize numbers, promises, contrasts, warnings, product terms, emotional hooks, "
        "and memorable keywords. Avoid filler and context-only lines.\n\n"
        f"Subtitle blocks:\n{json.dumps(indexed, ensure_ascii=False)}\n\n"
        "Return STRICT JSON array only. Each item:\n"
        "{\"i\":0,\"importance\":0.82,\"keyword\":\"Short keyword\","
        "\"display_text\":\"On-screen callout\","
        "\"moment_type\":\"hook|explanation|emotion|transition|cta\","
        "\"style_family\":\"cinematic_creator|ui_motion|kinetic_typography|hyper_dynamic\","
        "\"motion_role\":\"primary|secondary|ambient\","
        "\"important_words\":[\"AI\",\"replacing\"],"
        "\"motion_principle\":\"ease_out_overshoot\","
        "\"style\":\"editorial_image_text|kinetic_focus|stat_pulse|alert_snap|clean_callout|ui_tracker|cinematic_caption|clean_cta\","
        "\"placement\":\"center|lower_third|top_right|top_left|bottom_left\","
        "\"accent_color\":\"#7C3AED\","
        "\"sound_cue\":\"soft_whoosh|digital_click|impact|whoosh|soft_hit|clean_click\","
        "\"editing_note\":\"short editor note\","
        "\"reason\":\"short editor reason\"}"
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": MOTION_GRAPHICS_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.35,
            max_tokens=2500,
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = _parse_groq_json(raw)
    except Exception as exc:
        logger.warning("Groq motion graphic analysis failed: %s", exc)
        return {}

    result: Dict[int, Dict[str, Any]] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("i"))
        except Exception:
            continue
        if 0 <= idx < len(blocks):
            result[idx] = item
    return result


def _motion_html_preview(item: Dict[str, Any]) -> str:
    """Return a self-contained HTML/CSS/JS preview scene for future renderer use."""
    raw_text = str(item.get("display_text") or item.get("text") or item.get("keyword") or "Key Moment")
    keyword = html.escape(str(item.get("keyword") or "Motion Graphic"))
    accent = html.escape(str(item.get("accent_color") or "#7C3AED"))
    background = html.escape(str(item.get("background") or "rgba(245,243,255,0.92)"))
    important = {
        _normalize_text(str(word))
        for word in (item.get("important_words") or [])
        if _normalize_text(str(word))
    }
    text_parts: list[str] = []
    cursor = 0
    for match in re.finditer(r"[A-Za-z0-9']+", raw_text):
        text_parts.append(html.escape(raw_text[cursor:match.start()]))
        token = match.group(0)
        escaped = html.escape(token)
        if _normalize_text(token) in important:
            text_parts.append(f"<span>{escaped}</span>")
        else:
            text_parts.append(escaped)
        cursor = match.end()
    text_parts.append(html.escape(raw_text[cursor:]))
    text = "".join(text_parts)
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body{{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;font-family:Arial,sans-serif;}}
.scene{{width:1920px;height:1080px;display:grid;place-items:center;}}
.card{{min-width:520px;max-width:1180px;padding:54px 72px;border-radius:42px;background:{background};border:8px solid {accent};transform:scale(.86);opacity:0;animation:pop 3s cubic-bezier(.2,.9,.2,1) forwards;}}
.eyebrow{{font-size:34px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:{accent};margin-bottom:18px;}}
.title{{font-size:108px;line-height:.92;font-weight:1000;color:#0f172a;text-transform:uppercase;}}
.title span{{color:{accent};display:inline-block;animation:word 3s cubic-bezier(.2,.9,.2,1) forwards;}}
@keyframes pop{{0%{{opacity:0;transform:translateY(70px) scale(.86)}}14%{{opacity:1;transform:translateY(0) scale(1.04)}}24%,82%{{opacity:1;transform:scale(1)}}100%{{opacity:0;transform:translateY(-30px) scale(.96)}}}}
@keyframes word{{0%,10%{{transform:translateY(18px) scale(.94);filter:blur(5px)}}20%,82%{{transform:translateY(0) scale(1.08);filter:blur(0)}}100%{{transform:translateY(-8px) scale(1);filter:blur(0)}}}}
</style>
</head>
<body>
<div class="scene"><div class="card"><div class="eyebrow">{keyword}</div><div class="title">{text}</div></div></div>
</body>
</html>"""


def generate_motion_graphics_suggestions(
    cues: List[Dict[str, Any]],
    density: float = DEFAULT_DENSITY,
    max_items: int = DEFAULT_MAX_ITEMS,
) -> List[Dict[str, Any]]:
    if not cues:
        return []

    blocks = merge_cues_into_motion_blocks(cues)
    if not blocks:
        return []

    ai_items = _groq_motion_analysis(blocks[:80])
    enriched: list[dict[str, Any]] = []

    for index, block in enumerate(blocks):
        text = str(block.get("text", "") or "").strip()
        keyword = _keyword_from_text(text)
        importance = _heuristic_importance(text)
        block_start_ms = int(block.get("start_ms", 0) or 0)
        moment_type = _moment_type_for_block(text, block_start_ms, index, len(blocks))
        style_family = _style_family_for_text(text, moment_type, importance)
        design = _design_for_text(text, index, moment_type, style_family)
        display_text = _display_text(text, keyword)
        motion_role = _motion_role(moment_type, importance)
        motion_principle = _motion_principle(moment_type, style_family, motion_role)
        sound_cue = _sound_cue(style_family, moment_type, text)
        important_words = _important_words(text, keyword, display_text)
        editing_note = _editing_note(moment_type, style_family, motion_role, sound_cue)
        reason = "Strong visual keyword detected."

        ai = ai_items.get(index) or {}
        if ai:
            try:
                importance = max(importance, float(ai.get("importance", importance)))
            except Exception:
                pass
            keyword = str(ai.get("keyword") or keyword).strip() or keyword
            display_text = str(ai.get("display_text") or display_text).strip() or display_text
            moment_type = _safe_choice(ai.get("moment_type"), MOMENT_TYPES, moment_type)
            style_family = _safe_choice(ai.get("style_family"), STYLE_FAMILIES, style_family)
            motion_role = _safe_choice(ai.get("motion_role"), MOTION_ROLES, _motion_role(moment_type, importance))
            if block_start_ms <= 3200 or index == 0:
                moment_type = "hook"
                motion_role = "primary"
                if style_family == "cinematic_creator":
                    style_family = _style_family_for_text(text, moment_type, importance)
            motion_principle = str(ai.get("motion_principle") or _motion_principle(moment_type, style_family, motion_role)).strip()[:80]
            sound_cue = str(ai.get("sound_cue") or _sound_cue(style_family, moment_type, text)).strip()[:40]
            ai_words = ai.get("important_words")
            if isinstance(ai_words, list):
                important_words = [
                    str(word).strip()[:28]
                    for word in ai_words
                    if str(word).strip()
                ][:3] or important_words
            if not important_words:
                important_words = _important_words(text, keyword, display_text)
            design = _design_for_text(text, index, moment_type, style_family)
            ai_style = _safe_choice(ai.get("style"), MOTION_STYLES, "")
            if ai_style:
                design = _style_design(ai_style, index, moment_type)
            ai_placement = str(ai.get("placement") or "").strip()
            if ai_placement in {"center", "lower_third", "top_right", "top_left", "bottom_left"}:
                design["placement"] = ai_placement
            if design.get("style") == "editorial_image_text":
                design["placement"] = "center"
                design["animation"] = "word-opacity"
                design["background"] = "transparent"
                design["solid_background"] = MOTION_THEME_BACKGROUND
                design["shape"] = "editorial-poster-object"
            design["accent_color"] = MOTION_THEME_ACCENT
            editing_note = str(ai.get("editing_note") or _editing_note(moment_type, style_family, motion_role, sound_cue)).strip()[:180]
            reason = str(ai.get("reason") or reason)

        start_ms, end_ms = _motion_window_for_block(
            block,
            important_words,
            keyword,
            display_text,
            moment_type,
        )
        cue_id = str(block.get("cue_id") or f"cue_{index}")
        item = {
            "clip_id": f"motion-{cue_id}-{index}",
            "cue_id": cue_id,
            "text": display_text[:64],
            "keyword": keyword[:80],
            "source_text": text[:260],
            "start_ms": start_ms,
            "end_ms": end_ms,
            "duration_ms": end_ms - start_ms,
            "importance": round(max(0.0, min(1.0, importance)), 2),
            "style": design["style"],
            "style_family": style_family,
            "moment_type": moment_type,
            "motion_role": motion_role,
            "motion_principle": motion_principle,
            "important_words": important_words,
            "shape": design["shape"],
            "animation": design["animation"],
            "placement": design["placement"],
            "accent_color": design["accent_color"],
            "background": design["background"],
            "solid_background": design.get("solid_background", "#F8FAFC"),
            "sound_cue": sound_cue,
            "editing_note": editing_note,
            "reason": reason[:180],
        }
        item["html"] = _motion_html_preview(item)
        enriched.append(item)

    enriched.sort(key=lambda item: item["importance"], reverse=True)
    density = max(0.1, min(1.0, float(density or DEFAULT_DENSITY)))
    count = max(1, min(max_items, int(round(len(enriched) * density))))
    selected = [item for item in enriched if item["importance"] >= 0.45][:count]
    if not selected:
        selected = enriched[:count]

    selected.sort(key=lambda item: item["start_ms"])
    style_cycle = ["kinetic_focus", "clean_callout", "ui_tracker", "editorial_image_text", "cinematic_caption", "stat_pulse", "alert_snap"]
    previous_style = ""
    for sequence_index, item in enumerate(selected):
        current_style = str(item.get("style") or "clean_callout")
        if current_style == previous_style:
            replacement = next(
                (style for style in style_cycle if style != previous_style),
                "clean_callout",
            )
            design = _style_design(replacement, sequence_index, str(item.get("moment_type") or "explanation"))
            item.update({
                "style": design["style"],
                "shape": design["shape"],
                "animation": design["animation"],
                "placement": design["placement"],
                "background": design["background"],
                "solid_background": design["solid_background"],
            })
            current_style = design["style"]
        item["accent_color"] = MOTION_THEME_ACCENT
        previous_style = current_style

    for item in selected:
        if item.get("style") != "editorial_image_text":
            continue
        query = _pexels_photo_query(
            str(item.get("keyword") or ""),
            str(item.get("text") or ""),
            str(item.get("source_text") or ""),
        )
        photo = fetch_pexels_photo(query)
        if photo:
            item.update(photo)

    return selected
