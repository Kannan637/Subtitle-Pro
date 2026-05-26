"""Long-to-shorts analysis service.

Provides:
1) YouTube URL validation + optional download via yt-dlp.
2) Heuristic short-segment generation from subtitle cues.
"""
from __future__ import annotations

import logging
import json
import math
import os
import re
import subprocess
from typing import Any
from urllib.parse import parse_qs, urlparse

logger = logging.getLogger(__name__)

YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
}
HOOK_WORDS = {
    "why", "how", "secret", "mistake", "mistakes", "stop", "best", "top", "must",
    "never", "always", "improve", "boost", "growth", "viral", "proven", "result",
    "warning", "truth", "hack", "strategy", "easy", "fast", "here", "watch",
    "look", "imagine", "if", "this", "what", "don't", "do", "can",
}
IMPORTANT_WORDS = HOOK_WORDS | {
    "money", "revenue", "profit", "sales", "customers", "audience", "attention",
    "retention", "engagement", "hook", "story", "secret", "physical", "products",
    "amazon", "business", "brand", "growth", "system", "scale", "results",
    "mistake", "problem", "solution", "proof", "value", "win", "wins", "best",
}
EMOJI_RULES: tuple[tuple[set[str], str], ...] = (
    ({"money", "revenue", "profit", "sales", "income", "cash", "price"}, "💰"),
    ({"growth", "scale", "boost", "viral", "results", "win", "wins"}, "🚀"),
    ({"mistake", "problem", "warning", "wrong", "fail", "avoid"}, "⚠️"),
    ({"secret", "hack", "strategy", "tip", "trick", "system"}, "💡"),
    ({"amazon", "product", "products", "brand", "business", "customer", "customers"}, "📦"),
    ({"attention", "hook", "retention", "engagement", "audience", "watch"}, "🔥"),
    ({"video", "clip", "camera", "content", "creator", "shorts"}, "🎬"),
    ({"fitness", "exercise", "gym", "workout", "health", "body"}, "💪"),
    ({"ai", "automation", "software", "tool", "data", "tech"}, "🤖"),
    ({"home", "house", "remote", "family"}, "🏠"),
)
EMOJI_RULES = (
    ({"money", "revenue", "profit", "sales", "income", "cash", "price"}, "\U0001F4B0"),
    ({"growth", "scale", "boost", "viral", "results", "win", "wins"}, "\U0001F680"),
    ({"mistake", "problem", "warning", "wrong", "fail", "avoid"}, "\u26A0\uFE0F"),
    ({"secret", "hack", "strategy", "tip", "trick", "system"}, "\U0001F4A1"),
    ({"amazon", "product", "products", "brand", "business", "customer", "customers"}, "\U0001F4E6"),
    ({"attention", "hook", "retention", "engagement", "audience", "watch"}, "\U0001F525"),
    ({"video", "clip", "camera", "content", "creator", "shorts"}, "\U0001F3AC"),
    ({"fitness", "exercise", "gym", "workout", "health", "body"}, "\U0001F4AA"),
    ({"ai", "automation", "software", "tool", "data", "tech"}, "\U0001F916"),
    ({"home", "house", "remote", "family"}, "\U0001F3E0"),
)
CAPTION_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
    "from", "had", "has", "have", "he", "her", "his", "i", "if", "in", "is",
    "it", "its", "me", "my", "of", "on", "or", "our", "she", "so", "that",
    "the", "their", "them", "then", "there", "these", "they", "this", "those",
    "to", "up", "was", "we", "were", "with", "you", "your", "i've", "i'm",
}
HOOK_PHRASES = {
    "here is", "here's", "this is why", "the reason", "what if", "did you know",
    "let me show", "you need", "don't make", "stop doing", "i found", "i learned",
}
FILLER_START_WORDS = {
    "and", "but", "so", "because", "then", "also", "like", "um", "uh", "yeah", "okay",
}
CONTINUATION_END_WORDS = {
    "and", "but", "or", "so", "because", "to", "for", "with", "the", "a", "an", "of",
    "in", "on", "that", "which", "when", "while", "if",
}
ENDING_WORDS = {
    "finally", "result", "results", "therefore", "remember", "works", "done", "end",
    "away", "today", "tomorrow", "now", "again", "instead", "better",
}
PUNCT_RE = re.compile(r"[!?]")
NUMBER_RE = re.compile(r"\d")
WORD_RE = re.compile(r"[A-Za-z0-9']+")
CAPTION_WORDS_PER_CUE = 3
CAPTION_MAX_CHUNK_MS = 1100
CAPTION_MIN_CHUNK_MS = 180
CAPTION_DISPLAY_LEAD_MS = 40
CAPTION_DISPLAY_TAIL_MS = 90
BOUNDARY_LEAD_MS = 180
BOUNDARY_TAIL_MS = 260
BOUNDARY_NEXT_GUARD_MS = 60
VIRAL_SELECTION_MODEL = os.getenv("GROQ_LONG_TO_SHORTS_MODEL", "llama-3.3-70b-versatile")
LLM_CANDIDATE_LIMIT = 60
AUTO_TARGET_COUNT = 0
MAX_AUTO_VIRAL_CLIPS = 30
AUTO_MIN_VIRAL_SCORE = 58.0

TREND_ALIGNMENT_KEYWORDS = {
    "ai", "automation", "business", "creator", "content", "growth", "money",
    "sales", "marketing", "fitness", "health", "productivity", "mistake",
    "strategy", "amazon", "shorts", "youtube", "tiktok", "instagram", "brand",
    "retention", "hook", "audience", "viral", "system", "scale", "results",
}
EMOTION_WORDS = {
    "amazing", "angry", "best", "crazy", "disaster", "excited", "fail",
    "failed", "fear", "hate", "huge", "impossible", "insane", "love",
    "massive", "pain", "powerful", "problem", "secret", "shock", "shocking",
    "surprise", "terrible", "truth", "unbelievable", "warning", "win",
}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def normalize_youtube_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise ValueError("YouTube URL is required")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL must start with http:// or https://")
    if parsed.netloc.lower() not in YOUTUBE_HOSTS:
        raise ValueError("Only YouTube URLs are supported")

    if parsed.netloc.lower().endswith("youtu.be"):
        video_id = parsed.path.strip("/").split("/")[0]
        if not video_id:
            raise ValueError("Invalid YouTube short URL")
        return f"https://www.youtube.com/watch?v={video_id}"

    qs = parse_qs(parsed.query)
    video_id = (qs.get("v") or [""])[0]
    if not video_id:
        # Accept /shorts/{id}
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) >= 2 and path_parts[0] == "shorts":
            video_id = path_parts[1]
    if not video_id:
        raise ValueError("Could not extract YouTube video ID")
    return f"https://www.youtube.com/watch?v={video_id}"


def _probe_duration_seconds(media_path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                media_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            return 0.0
        return max(0.0, float((result.stdout or "0").strip() or 0))
    except Exception:
        return 0.0


def fetch_youtube_metadata(youtube_url: str) -> dict[str, Any]:
    cmd = [
        "yt-dlp",
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        youtube_url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    except FileNotFoundError as exc:
        raise RuntimeError("yt-dlp is not installed on the server") from exc
    except Exception as exc:
        raise RuntimeError(f"Failed to run yt-dlp metadata probe: {exc}") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"yt-dlp metadata probe failed: {err[:300]}")

    try:
        import json
        data = json.loads((proc.stdout or "").strip() or "{}")
    except Exception as exc:
        raise RuntimeError("Failed to parse yt-dlp metadata response") from exc

    return {
        "title": str(data.get("title") or "YouTube Import"),
        "duration_sec": int(float(data.get("duration") or 0)),
        "webpage_url": str(data.get("webpage_url") or youtube_url),
        "video_id": str(data.get("id") or ""),
    }


def download_youtube_video(youtube_url: str, project_id: str, upload_dir: str = "uploads") -> dict[str, Any]:
    os.makedirs(upload_dir, exist_ok=True)
    safe_template = os.path.join(upload_dir, f"{project_id}_yt_%(id)s.%(ext)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--merge-output-format",
        "mp4",
        "-f",
        "mp4/best[ext=mp4]/best",
        "-o",
        safe_template,
        "--print",
        "after_move:filepath",
        youtube_url,
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    except FileNotFoundError as exc:
        raise RuntimeError("yt-dlp is not installed on the server") from exc
    except Exception as exc:
        raise RuntimeError(f"Failed to run yt-dlp download: {exc}") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"YouTube download failed: {err[:500]}")

    lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.strip()]
    file_path = lines[-1] if lines else ""
    if not file_path or not os.path.exists(file_path):
        raise RuntimeError("Downloaded file path was not returned by yt-dlp")

    real_upload_dir = os.path.realpath(upload_dir)
    real_file = os.path.realpath(file_path)
    if not (real_file == real_upload_dir or real_file.startswith(real_upload_dir + os.sep)):
        raise RuntimeError("Downloaded file resolved outside upload directory")

    duration_sec = _probe_duration_seconds(file_path)
    return {
        "file_path": file_path,
        "duration_sec": int(duration_sec),
    }


def _score_candidate(
    text: str,
    duration_sec: float,
    start_ratio: float,
    cue_count: int,
    hook_score: float = 0.0,
    end_score: float = 0.0,
) -> float:
    words = [w for w in re.split(r"\s+", text.lower()) if w]
    if not words:
        return 0.0

    unique_ratio = len(set(words)) / max(1, len(words))
    hook_hits = sum(1 for w in words if w.strip(".,!?;:") in HOOK_WORDS)
    punctuation_boost = len(PUNCT_RE.findall(text))
    number_boost = 1 if NUMBER_RE.search(text) else 0

    if duration_sec <= 0:
        duration_fit = 0.0
    elif duration_sec < 12:
        duration_fit = 0.55
    elif duration_sec <= 40:
        duration_fit = 1.0
    elif duration_sec <= 58:
        duration_fit = 0.8
    else:
        duration_fit = 0.3

    words_per_sec = len(words) / max(1.0, duration_sec)
    pace_fit = 1.0 - abs(words_per_sec - 2.6) / 2.6
    pace_fit = _clamp(pace_fit, 0.2, 1.0)

    intro_penalty = 0.94 if start_ratio < 0.04 else 1.0

    raw = (
        45.0 * duration_fit
        + 18.0 * pace_fit
        + 13.0 * unique_ratio
        + min(12.0, hook_hits * 2.2)
        + min(6.0, punctuation_boost * 1.5)
        + (3.5 if number_boost else 0.0)
        + min(4.0, cue_count * 0.35)
        + min(18.0, hook_score * 1.15)
        + min(16.0, end_score * 1.05)
    ) * intro_penalty
    return _clamp(raw, 25.0, 98.0)


def _keyword_set(text: str) -> set[str]:
    return {
        word
        for word in _cue_words(text)
        if len(word) >= 3 and word not in CAPTION_STOP_WORDS
    }


def _keyword_overlap(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / max(1, len(left | right))


def _infer_video_chapters(ordered_cues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build semantic chapters from transcript drift and timing gaps.

    This is intentionally deterministic. Groq receives the chapters later for
    editorial reasoning, while this layer keeps timings stable and testable.
    """
    chapters: list[dict[str, Any]] = []
    current: list[dict[str, Any]] = []
    current_keywords: set[str] = set()

    def flush() -> None:
        nonlocal current, current_keywords
        if not current:
            return
        text = " ".join(str(cue.get("text", "") or "") for cue in current)
        ranked_keywords = sorted(
            _keyword_set(text),
            key=lambda word: (
                0 if word in TREND_ALIGNMENT_KEYWORDS else 1,
                -text.lower().count(word),
                word,
            ),
        )[:6]
        chapters.append(
            {
                "chapter_index": len(chapters) + 1,
                "start_ms": int(current[0].get("start_ms", 0) or 0),
                "end_ms": int(current[-1].get("end_ms", 0) or 0),
                "topic_keywords": ranked_keywords,
                "summary": _truncate_for_prompt(" ".join(ranked_keywords), 80) or "general",
            }
        )
        current = []
        current_keywords = set()

    for index, cue in enumerate(ordered_cues):
        cue_text = str(cue.get("text", "") or "")
        cue_keywords = _keyword_set(cue_text)
        previous = ordered_cues[index - 1] if index > 0 else None
        gap_ms = _cue_gap_ms(previous, cue) if previous else 0
        drift = 1.0 - _keyword_overlap(current_keywords, cue_keywords) if current_keywords and cue_keywords else 0.0
        current_duration_ms = (
            int(previous.get("end_ms", 0) or 0) - int(current[0].get("start_ms", 0) or 0)
            if current and previous
            else 0
        )

        if current and (gap_ms >= 2600 or (current_duration_ms >= 45_000 and drift >= 0.86)):
            flush()

        current.append(cue)
        current_keywords |= cue_keywords

    flush()
    return chapters


def _chapter_for_window(
    chapters: list[dict[str, Any]],
    start_ms: int,
    end_ms: int,
) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    best_overlap = 0
    for chapter in chapters:
        overlap = max(
            0,
            min(end_ms, int(chapter.get("end_ms", 0) or 0))
            - max(start_ms, int(chapter.get("start_ms", 0) or 0)),
        )
        if overlap > best_overlap:
            best_overlap = overlap
            best = chapter
    return best


def _filler_word_penalty(words: list[str]) -> float:
    if not words:
        return 0.0
    filler_count = sum(1 for word in words if word in FILLER_START_WORDS or word in {"basically", "actually", "literally"})
    return _clamp((filler_count / max(1, len(words))) * 100.0, 0.0, 18.0)


def _signal_breakdown(
    *,
    text: str,
    duration_sec: float,
    start_quality: float,
    ending_quality: float,
    start_ms: int,
    total_end_ms: int,
    cue_count: int,
    chapter: dict[str, Any] | None,
) -> dict[str, float]:
    words = _cue_words(text)
    text_lower = text.lower()
    hook_quality = _clamp(48.0 + start_quality * 1.75, 0.0, 100.0)
    emotional_intensity = _clamp(
        len(PUNCT_RE.findall(text)) * 11.0
        + sum(1 for word in words if word in EMOTION_WORDS) * 8.0
        + (10.0 if NUMBER_RE.search(text) else 0.0),
        0.0,
        100.0,
    )
    chapter_keywords = set(str(word).lower() for word in (chapter or {}).get("topic_keywords", []))
    trend_hits = len((_keyword_set(text) | chapter_keywords) & TREND_ALIGNMENT_KEYWORDS)
    topic_trend_alignment = _clamp(18.0 + trend_hits * 12.0, 0.0, 100.0)
    words_per_sec = len(words) / max(1.0, duration_sec)
    silence_or_gap_penalty = max(0.0, duration_sec - (cue_count * 4.2)) * 2.0
    audio_engagement = _clamp(100.0 - abs(words_per_sec - 2.65) * 18.0 - silence_or_gap_penalty, 0.0, 100.0)
    standalone_coherence = _clamp(52.0 + ending_quality * 1.9 + min(18.0, cue_count * 1.2), 0.0, 100.0)
    filler_penalty = _filler_word_penalty(words)
    mid_sentence_start_penalty = 0.0
    if words:
        if words[0] in FILLER_START_WORDS:
            mid_sentence_start_penalty += 18.0
        if start_ms / max(1, total_end_ms) < 0.02 and not any(word in text_lower for word in ("today", "here", "this", "why", "how")):
            mid_sentence_start_penalty += 5.0

    return {
        "hook_quality": round(hook_quality, 1),
        "emotional_intensity": round(emotional_intensity, 1),
        "topic_trend_alignment": round(topic_trend_alignment, 1),
        "audio_engagement": round(audio_engagement, 1),
        "standalone_coherence": round(standalone_coherence, 1),
        "filler_word_penalty": round(filler_penalty, 1),
        "mid_sentence_start_penalty": round(_clamp(mid_sentence_start_penalty, 0.0, 30.0), 1),
        "visual_action": 0.0,
    }


def _virality_score_from_signals(signal: dict[str, float], heuristic_score: float) -> float:
    raw = (
        signal.get("hook_quality", 0.0) * 0.24
        + signal.get("emotional_intensity", 0.0) * 0.13
        + signal.get("topic_trend_alignment", 0.0) * 0.13
        + signal.get("audio_engagement", 0.0) * 0.14
        + signal.get("standalone_coherence", 0.0) * 0.24
        + heuristic_score * 0.20
        - signal.get("filler_word_penalty", 0.0) * 0.60
        - signal.get("mid_sentence_start_penalty", 0.0) * 0.75
    )
    return round(_clamp(raw, 25.0, 99.0), 1)


def _build_caption_summary(captions: list[str], max_chars: int = 120) -> str:
    joined = " ".join(c.strip() for c in captions if c and c.strip()).strip()
    if len(joined) <= max_chars:
        return joined
    clipped = joined[: max_chars - 1].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return clipped + "…"


def _cue_words(text: str) -> list[str]:
    return [word.lower() for word in WORD_RE.findall(text or "") if word.strip()]


def _cue_gap_ms(left: dict[str, Any] | None, right: dict[str, Any] | None) -> int:
    if not left or not right:
        return 0
    return int(right.get("start_ms", 0) or 0) - int(left.get("end_ms", 0) or 0)


def _hook_score(cue: dict[str, Any], previous_cue: dict[str, Any] | None) -> float:
    text = str(cue.get("text", "") or "").strip()
    words = _cue_words(text)
    if not words:
        return 0.0

    first_words = words[:8]
    phrase_window = " ".join(first_words)
    score = 0.0
    if first_words[0] in HOOK_WORDS:
        score += 10.0
    if any(word in HOOK_WORDS for word in first_words):
        score += 7.0
    if any(phrase in phrase_window for phrase in HOOK_PHRASES):
        score += 10.0
    if "?" in text or "!" in text:
        score += 5.0
    if NUMBER_RE.search(text):
        score += 4.0
    if previous_cue and _cue_gap_ms(previous_cue, cue) >= 650:
        score += 4.0
    if first_words[0] in FILLER_START_WORDS:
        score -= 9.0
    return _clamp(score, -10.0, 28.0)


def _end_score(cue: dict[str, Any], next_cue: dict[str, Any] | None) -> float:
    text = str(cue.get("text", "") or "").strip()
    words = _cue_words(text)
    if not text or not words:
        return 0.0

    score = 0.0
    last = words[-1].strip(".,!?;:")
    if text[-1:] in {".", "!", "?"}:
        score += 13.0
    if text[-1:] in {"!", "?"}:
        score += 3.0
    if next_cue and _cue_gap_ms(cue, next_cue) >= 650:
        score += 7.0
    if not next_cue:
        score += 5.0
    if last in ENDING_WORDS:
        score += 3.0
    if text[-1:] in {",", ";", ":"} or last in CONTINUATION_END_WORDS:
        score -= 13.0
    return _clamp(score, -14.0, 24.0)


def _tail_padded_end_ms(end_ms: int, next_cue: dict[str, Any] | None, total_end_ms: int) -> int:
    padded = min(total_end_ms, int(end_ms) + BOUNDARY_TAIL_MS)
    if next_cue:
        next_start = int(next_cue.get("start_ms", padded) or padded)
        padded = min(padded, max(end_ms, next_start - 40))
    return max(end_ms, padded)


def _normalize_word(value: str) -> str:
    matches = WORD_RE.findall(value or "")
    return matches[0].lower() if matches else ""


def detect_important_words(text: str, limit: int = 1) -> list[str]:
    """Pick the few words that should get visual emphasis in a caption chunk."""
    tokens = WORD_RE.findall(text or "")
    if not tokens:
        return []

    candidates: list[tuple[float, int, str, str]] = []
    for index, token in enumerate(tokens):
        normalized = token.lower().strip("'")
        if not normalized or normalized in CAPTION_STOP_WORDS or len(normalized) < 3:
            continue

        score = float(min(len(normalized), 14))
        if normalized in IMPORTANT_WORDS:
            score += 100.0
        if NUMBER_RE.search(token):
            score += 90.0
        if token.isupper() and len(token) > 1:
            score += 32.0
        if normalized.endswith(("ing", "ion", "ity", "ive", "ment", "ness")):
            score += 8.0
        candidates.append((score, index, normalized, token))

    if not candidates:
        return []

    picked: list[str] = []
    seen: set[str] = set()
    for _, _, normalized, token in sorted(candidates, key=lambda item: (-item[0], item[1])):
        if normalized in seen:
            continue
        seen.add(normalized)
        picked.append(token)
        if len(picked) >= max(1, limit):
            break
    return picked


def pick_related_emoji(text: str, important_words: list[str] | None = None) -> str:
    important_text = " ".join(str(word).strip() for word in (important_words or []) if str(word).strip())
    source_text = important_text or text
    words = set(_cue_words(source_text))
    for triggers, emoji in EMOJI_RULES:
        if words & triggers:
            return emoji
    return ""


def _clean_highlight_words_for_text(text: str, highlight_words: Any) -> list[str]:
    text_words = {
        normalized
        for token in re.findall(r"\S+", text or "")
        if (normalized := _normalize_word(token))
    }
    cleaned: list[str] = []
    seen: set[str] = set()
    if isinstance(highlight_words, list):
        for word in highlight_words:
            value = str(word).strip()
            normalized = _normalize_word(value)
            if not value or not normalized or normalized not in text_words or normalized in seen:
                continue
            seen.add(normalized)
            cleaned.append(value)

    return cleaned or detect_important_words(text)


def _emoji_window_from_timed_words(
    words: list[dict[str, Any]],
    highlight_words: list[str],
    short_start_ms: int,
    short_end_ms: int,
) -> tuple[int, int] | None:
    highlight_set = {
        normalized
        for word in highlight_words
        if (normalized := _normalize_word(str(word)))
    }
    if not highlight_set:
        return None

    for word in words:
        token = str(word.get("word", "") or "").strip()
        if _normalize_word(token) not in highlight_set:
            continue
        start_ms = max(short_start_ms, int(word.get("start_ms", short_start_ms) or short_start_ms))
        end_ms = min(short_end_ms, int(word.get("end_ms", start_ms) or start_ms))
        if end_ms > start_ms:
            return start_ms, end_ms
    return None


def _estimate_emoji_window_from_text(
    text: str,
    highlight_words: list[str],
    start_ms: int,
    end_ms: int,
) -> tuple[int, int] | None:
    highlight_set = {
        normalized
        for word in highlight_words
        if (normalized := _normalize_word(str(word)))
    }
    tokens = [token for token in re.findall(r"\S+", text or "") if token]
    if not highlight_set or not tokens or end_ms <= start_ms:
        return None

    weights = [max(1, len(_normalize_word(token) or token)) for token in tokens]
    total_weight = max(1, sum(weights))
    duration_ms = max(1, end_ms - start_ms)
    cursor_weight = 0
    for index, token in enumerate(tokens):
        token_start = start_ms + int(round(duration_ms * (cursor_weight / total_weight)))
        cursor_weight += weights[index]
        token_end = start_ms + int(round(duration_ms * (cursor_weight / total_weight)))
        if _normalize_word(token) in highlight_set:
            return token_start, max(token_start + 1, token_end)
    return None


def _apply_emoji_timing(
    chunk: dict[str, Any],
    emoji: str,
    window: tuple[int, int] | None,
    short_start_ms: int,
) -> dict[str, Any]:
    if not emoji or not window:
        chunk["emoji"] = ""
        return chunk

    emoji_start_ms, emoji_end_ms = window
    caption_start_ms = int(chunk.get("start_ms", emoji_start_ms) or emoji_start_ms)
    caption_end_ms = int(chunk.get("end_ms", emoji_end_ms) or emoji_end_ms)
    emoji_start_ms = max(caption_start_ms, emoji_start_ms)
    emoji_end_ms = min(caption_end_ms, emoji_end_ms)
    if emoji_end_ms <= emoji_start_ms:
        chunk["emoji"] = ""
        return chunk

    chunk["emoji"] = emoji
    chunk["emoji_start_ms"] = emoji_start_ms
    chunk["emoji_end_ms"] = emoji_end_ms
    chunk["emoji_relative_start_ms"] = emoji_start_ms - short_start_ms
    chunk["emoji_relative_end_ms"] = emoji_end_ms - short_start_ms
    return chunk


def _read_timing_ms(word: dict[str, Any], key_ms: str, key_s: str) -> int | None:
    if word.get(key_ms) is not None:
        try:
            return int(round(float(word.get(key_ms) or 0)))
        except Exception:
            return None
    if word.get(key_s) is not None:
        try:
            return int(round(float(word.get(key_s) or 0) * 1000))
        except Exception:
            return None
    return None


def _coerce_word_timings(
    cue: dict[str, Any],
    start_ms: int,
    end_ms: int,
) -> list[dict[str, Any]]:
    raw_words = cue.get("words")
    if not isinstance(raw_words, list):
        return []

    timed_words: list[dict[str, Any]] = []
    for item in raw_words:
        if not isinstance(item, dict):
            continue
        token = str(item.get("word") or item.get("text") or item.get("token") or "").strip()
        if not token:
            continue

        word_start = _read_timing_ms(item, "start_ms", "start")
        word_end = _read_timing_ms(item, "end_ms", "end")
        if word_start is None or word_end is None:
            continue
        if word_end <= word_start:
            word_end = word_start + max(CAPTION_MIN_CHUNK_MS, min(360, len(token) * 55))

        clipped_start = max(start_ms, word_start)
        clipped_end = min(end_ms, word_end)
        if clipped_end <= clipped_start:
            continue

        timed_words.append(
            {
                "word": token,
                "start_ms": int(clipped_start),
                "end_ms": int(clipped_end),
            }
        )

    timed_words.sort(key=lambda item: (item["start_ms"], item["end_ms"]))
    return timed_words


def _chunk_from_words(
    cue: dict[str, Any],
    index: int,
    words: list[dict[str, Any]],
    short_start_ms: int,
    short_end_ms: int,
) -> dict[str, Any] | None:
    if not words:
        return None

    text = " ".join(str(word.get("word", "") or "").strip() for word in words).strip()
    if not text:
        return None

    start_ms = max(short_start_ms, int(words[0]["start_ms"]) - CAPTION_DISPLAY_LEAD_MS)
    end_ms = min(short_end_ms, int(words[-1]["end_ms"]) + CAPTION_DISPLAY_TAIL_MS)
    if end_ms <= start_ms:
        end_ms = min(short_end_ms, start_ms + CAPTION_MIN_CHUNK_MS)
    if end_ms <= start_ms:
        return None

    clean_highlight_words = _clean_highlight_words_for_text(text, cue.get("highlight_words"))
    emoji = pick_related_emoji(text, clean_highlight_words)
    emoji_window = _emoji_window_from_timed_words(words, clean_highlight_words, short_start_ms, short_end_ms)

    chunk = {
        "id": f"{str(cue.get('id', '') or '')}-{index}",
        "text": text,
        "start_ms": start_ms,
        "end_ms": end_ms,
        "relative_start_ms": start_ms - short_start_ms,
        "relative_end_ms": end_ms - short_start_ms,
        "highlight_words": clean_highlight_words,
        "words": [
            {
                "word": str(word.get("word", "") or "").strip(),
                "start_ms": int(word.get("start_ms", start_ms) or start_ms),
                "end_ms": int(word.get("end_ms", end_ms) or end_ms),
                "relative_start_ms": int(word.get("start_ms", start_ms) or start_ms) - short_start_ms,
                "relative_end_ms": int(word.get("end_ms", end_ms) or end_ms) - short_start_ms,
            }
            for word in words
            if str(word.get("word", "") or "").strip()
        ],
    }
    return _apply_emoji_timing(chunk, emoji, emoji_window, short_start_ms)


def _trim_caption_chunk_overlaps(
    chunks: list[dict[str, Any]],
    short_start_ms: int,
) -> list[dict[str, Any]]:
    ordered = sorted(chunks, key=lambda item: (int(item.get("start_ms", 0) or 0), int(item.get("end_ms", 0) or 0)))
    for index in range(len(ordered) - 1):
        current = ordered[index]
        next_chunk = ordered[index + 1]
        current_start = int(current.get("start_ms", 0) or 0)
        current_end = int(current.get("end_ms", current_start) or current_start)
        next_start = int(next_chunk.get("start_ms", current_end) or current_end)
        if current_end <= next_start:
            continue
        current["end_ms"] = max(current_start + 1, next_start)
        current["relative_end_ms"] = int(current["end_ms"]) - short_start_ms

    for chunk in ordered:
        emoji = str(chunk.get("emoji") or "").strip()
        if not emoji:
            continue
        start_ms = int(chunk.get("start_ms", 0) or 0)
        end_ms = int(chunk.get("end_ms", start_ms) or start_ms)
        emoji_start_ms = max(start_ms, int(chunk.get("emoji_start_ms", start_ms) or start_ms))
        emoji_end_ms = min(end_ms, int(chunk.get("emoji_end_ms", emoji_start_ms) or emoji_start_ms))
        if emoji_end_ms <= emoji_start_ms:
            chunk["emoji"] = ""
            chunk.pop("emoji_start_ms", None)
            chunk.pop("emoji_end_ms", None)
            chunk.pop("emoji_relative_start_ms", None)
            chunk.pop("emoji_relative_end_ms", None)
            continue
        chunk["emoji_start_ms"] = emoji_start_ms
        chunk["emoji_end_ms"] = emoji_end_ms
        chunk["emoji_relative_start_ms"] = emoji_start_ms - short_start_ms
        chunk["emoji_relative_end_ms"] = emoji_end_ms - short_start_ms

    return [
        chunk
        for chunk in ordered
        if int(chunk.get("end_ms", 0) or 0) > int(chunk.get("start_ms", 0) or 0)
    ]


def _clip_caption_cues(
    cues: list[dict[str, Any]],
    short_start_ms: int,
    short_end_ms: int,
) -> list[dict[str, Any]]:
    clipped: list[dict[str, Any]] = []
    for cue in cues:
        clipped.extend(split_caption_cue_to_chunks(cue, short_start_ms, short_end_ms))
    return clipped


def _cue_timed_words(cue: dict[str, Any]) -> list[dict[str, Any]]:
    start_ms = int(cue.get("start_ms", 0) or 0)
    end_ms = int(cue.get("end_ms", start_ms) or start_ms)
    if end_ms <= start_ms:
        return []
    return _coerce_word_timings(cue, start_ms, end_ms)


def _snap_window_start_ms(
    ordered: list[dict[str, Any]],
    index: int,
) -> tuple[int, int]:
    cue = ordered[index]
    cue_start = max(0, int(cue.get("start_ms", 0) or 0))
    timed_words = _cue_timed_words(cue)
    first_word_start = int(timed_words[0]["start_ms"]) if timed_words else cue_start
    desired = max(0, min(cue_start, first_word_start) - BOUNDARY_LEAD_MS)

    if index > 0:
        prev_end = int(ordered[index - 1].get("end_ms", 0) or 0)
        desired = max(desired, prev_end + BOUNDARY_NEXT_GUARD_MS)

    return max(0, min(desired, first_word_start)), first_word_start


def _snap_window_end_ms(
    cue: dict[str, Any],
    next_cue: dict[str, Any] | None,
    total_end_ms: int,
) -> tuple[int, int]:
    cue_end = int(cue.get("end_ms", 0) or 0)
    timed_words = _cue_timed_words(cue)
    last_word_end = int(timed_words[-1]["end_ms"]) if timed_words else cue_end
    spoken_end = max(cue_end, last_word_end)
    padded = min(total_end_ms, spoken_end + BOUNDARY_TAIL_MS)

    if next_cue:
        next_start = int(next_cue.get("start_ms", padded) or padded)
        if next_start > spoken_end:
            padded = min(padded, max(spoken_end, next_start - BOUNDARY_NEXT_GUARD_MS))

    return max(spoken_end, padded), last_word_end


def split_caption_cue_to_chunks(
    cue: dict[str, Any],
    short_start_ms: int,
    short_end_ms: int,
    max_words: int = CAPTION_WORDS_PER_CUE,
) -> list[dict[str, Any]]:
    text = str(cue.get("text", "") or "").strip()
    if not text:
        return []

    cue_start = int(cue.get("start_ms", 0) or 0)
    cue_end = int(cue.get("end_ms", 0) or 0)
    start_ms = max(short_start_ms, cue_start)
    end_ms = min(short_end_ms, cue_end)
    if end_ms <= start_ms:
        return []

    words = [word for word in re.findall(r"\S+", text) if word]
    if not words:
        return []

    group_size = max(1, int(max_words))
    timed_words = _coerce_word_timings(cue, start_ms, end_ms)
    if timed_words:
        groups: list[list[dict[str, Any]]] = []
        current: list[dict[str, Any]] = []
        for word in timed_words:
            if current:
                span_ms = int(word["end_ms"]) - int(current[0]["start_ms"])
                if len(current) >= group_size or span_ms > CAPTION_MAX_CHUNK_MS:
                    groups.append(current)
                    current = []
            current.append(word)
        if current:
            groups.append(current)

        timed_chunks = [
            chunk
            for index, group in enumerate(groups)
            if (chunk := _chunk_from_words(cue, index, group, short_start_ms, short_end_ms)) is not None
        ]
        if timed_chunks:
            return _trim_caption_chunk_overlaps(timed_chunks, short_start_ms)

    groups = [words[index:index + group_size] for index in range(0, len(words), group_size)]
    group_weights = [sum(max(1, len(_normalize_word(word) or word)) for word in group) for group in groups]
    total_weight = max(1, sum(group_weights))
    duration_ms = max(1, end_ms - start_ms)
    chunks: list[dict[str, Any]] = []
    cursor = start_ms
    consumed_weight = 0

    for index, group in enumerate(groups):
        consumed_weight += group_weights[index]
        if index == len(groups) - 1:
            natural_end = end_ms
        else:
            natural_end = start_ms + int(round(duration_ms * (consumed_weight / total_weight)))

        chunk_end = end_ms if index == len(groups) - 1 else min(natural_end, cursor + CAPTION_MAX_CHUNK_MS)
        if chunk_end <= cursor:
            chunk_end = min(end_ms, cursor + CAPTION_MIN_CHUNK_MS)
        if chunk_end <= cursor:
            continue

        chunk_text = " ".join(group)
        clean_highlight_words = _clean_highlight_words_for_text(chunk_text, cue.get("highlight_words"))
        emoji = pick_related_emoji(chunk_text, clean_highlight_words)
        emoji_window = _estimate_emoji_window_from_text(chunk_text, clean_highlight_words, cursor, chunk_end)
        chunk = {
            "id": f"{str(cue.get('id', '') or '')}-{index}",
            "text": chunk_text,
            "start_ms": cursor,
            "end_ms": chunk_end,
            "relative_start_ms": cursor - short_start_ms,
            "relative_end_ms": chunk_end - short_start_ms,
            "highlight_words": clean_highlight_words,
        }
        chunks.append(_apply_emoji_timing(chunk, emoji, emoji_window, short_start_ms))
        cursor = chunk_end
        if cursor >= end_ms:
            break

    return _trim_caption_chunk_overlaps(chunks, short_start_ms)


def _generate_viral_candidate_pool(
    cues: list[dict[str, Any]],
    *,
    min_duration_sec: int,
    max_duration_sec: int,
) -> list[dict[str, Any]]:
    """Build many clean transcript windows for AI ranking."""
    ordered = sorted(
        [
            {
                "id": str(c.get("_id", "")),
                "text": str(c.get("text", "") or "").strip(),
                "start_ms": int(c.get("start_ms", 0) or 0),
                "end_ms": int(c.get("end_ms", 0) or 0),
                "words": c.get("words") if isinstance(c.get("words"), list) else [],
            }
            for c in cues
            if str(c.get("text", "") or "").strip()
        ],
        key=lambda c: (c["start_ms"], c["end_ms"]),
    )
    if not ordered:
        return []

    chapters = _infer_video_chapters(ordered)
    min_ms = max(5_000, int(min_duration_sec * 1000))
    max_ms = max(min_ms + 1000, int(max_duration_sec * 1000))
    total_end_ms = max(ordered[-1]["end_ms"], min_ms)

    candidates: list[dict[str, Any]] = []
    for i in range(len(ordered)):
        spoken_start_ms = max(0, ordered[i]["start_ms"])
        cut_start_ms, first_word_start_ms = _snap_window_start_ms(ordered, i)
        start_quality = _hook_score(ordered[i], ordered[i - 1] if i > 0 else None)
        window_cues: list[dict[str, Any]] = []
        end_ms = spoken_start_ms

        for j in range(i, len(ordered)):
            end_ms = max(end_ms, ordered[j]["end_ms"])
            window_cues.append(ordered[j])
            duration_ms = end_ms - spoken_start_ms
            if duration_ms < min_ms:
                continue
            if duration_ms > max_ms:
                break

            window_caps = [str(cue["text"]) for cue in window_cues]
            window_text = " ".join(window_caps).strip()
            if len(window_text) < 24:
                continue

            duration_sec = duration_ms / 1000.0
            next_cue = ordered[j + 1] if j + 1 < len(ordered) else None
            ending_quality = _end_score(ordered[j], next_cue)
            score = _score_candidate(
                text=window_text,
                duration_sec=duration_sec,
                start_ratio=spoken_start_ms / max(1, total_end_ms),
                cue_count=(j - i + 1),
                hook_score=start_quality,
                end_score=ending_quality,
            )
            primary_caption = _build_caption_summary(window_caps[:2], max_chars=92)
            title = _build_caption_summary([window_text], max_chars=64)
            final_end_ms, last_word_end_ms = _snap_window_end_ms(ordered[j], next_cue, total_end_ms)
            max_allowed_end_ms = cut_start_ms + max_ms
            if max_allowed_end_ms < end_ms:
                continue
            final_end_ms = min(final_end_ms, max_allowed_end_ms)
            if final_end_ms <= cut_start_ms:
                continue
            chapter = _chapter_for_window(chapters, cut_start_ms, final_end_ms)
            signal_breakdown = _signal_breakdown(
                text=window_text,
                duration_sec=duration_sec,
                start_quality=start_quality,
                ending_quality=ending_quality,
                start_ms=spoken_start_ms,
                total_end_ms=total_end_ms,
                cue_count=(j - i + 1),
                chapter=chapter,
            )
            virality_score = _virality_score_from_signals(signal_breakdown, score)
            candidates.append(
                {
                    "candidate_id": "",
                    "start_ms": cut_start_ms,
                    "end_ms": final_end_ms,
                    "content_end_ms": end_ms,
                    "duration_sec": round((final_end_ms - cut_start_ms) / 1000.0, 2),
                    "engagement_rate": virality_score,
                    "primary_caption": primary_caption,
                    "title": title if title else "Short segment",
                    "captions": window_caps[:],
                    "caption_cues": _clip_caption_cues(window_cues, cut_start_ms, final_end_ms),
                    "hook_score": round(start_quality, 2),
                    "end_score": round(ending_quality, 2),
                    "heuristic_score": round(score, 1),
                    "score_breakdown": signal_breakdown,
                    "chapter": chapter,
                    "source_segments": [{"start_ms": cut_start_ms, "end_ms": final_end_ms}],
                    "opening_text": str(window_caps[0] if window_caps else ""),
                    "ending_text": str(window_caps[-1] if window_caps else ""),
                    "cut_quality": {
                        "mode": "word_safe",
                        "first_word_start_ms": first_word_start_ms,
                        "last_word_end_ms": last_word_end_ms,
                        "lead_padding_ms": max(0, first_word_start_ms - cut_start_ms),
                        "tail_padding_ms": max(0, final_end_ms - last_word_end_ms),
                    },
                }
            )

            punct = ordered[j]["text"][-1:] if ordered[j]["text"] else ""
            clean_end = ending_quality >= 7.0 or punct in {".", "!", "?"}
            if clean_end:
                break

    if not candidates:
        total_start = ordered[0]["start_ms"]
        total_span = max(min_ms, ordered[-1]["end_ms"] - total_start)
        chunk_ms = max(min_ms, min(max_ms, math.ceil(total_span / 4)))
        for idx in range(4):
            start_ms = total_start + idx * chunk_ms
            if start_ms >= ordered[-1]["end_ms"]:
                break
            end_ms = min(start_ms + chunk_ms, ordered[-1]["end_ms"])
            cap_cues = [c for c in ordered if c["start_ms"] < end_ms and c["end_ms"] > start_ms]
            cap_lines = [str(c["text"]) for c in cap_cues]
            if not cap_lines:
                continue
            text = " ".join(cap_lines)
            duration_sec = (end_ms - start_ms) / 1000.0
            heuristic_score = _score_candidate(text, duration_sec, start_ms / max(1, total_end_ms), len(cap_lines))
            chapter = _chapter_for_window(chapters, start_ms, end_ms)
            signal_breakdown = _signal_breakdown(
                text=text,
                duration_sec=duration_sec,
                start_quality=0.0,
                ending_quality=0.0,
                start_ms=start_ms,
                total_end_ms=total_end_ms,
                cue_count=len(cap_lines),
                chapter=chapter,
            )
            candidates.append(
                {
                    "candidate_id": "",
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "content_end_ms": end_ms,
                    "duration_sec": round(duration_sec, 2),
                    "engagement_rate": _virality_score_from_signals(signal_breakdown, heuristic_score),
                    "primary_caption": _build_caption_summary(cap_lines[:2], max_chars=92),
                    "title": _build_caption_summary([text], max_chars=64) or "Short segment",
                    "captions": cap_lines,
                    "caption_cues": _clip_caption_cues(cap_cues, start_ms, end_ms),
                    "hook_score": 0.0,
                    "end_score": 0.0,
                    "heuristic_score": round(heuristic_score, 1),
                    "score_breakdown": signal_breakdown,
                    "chapter": chapter,
                    "source_segments": [{"start_ms": start_ms, "end_ms": end_ms}],
                    "opening_text": str(cap_lines[0] if cap_lines else ""),
                    "ending_text": str(cap_lines[-1] if cap_lines else ""),
                    "cut_quality": {
                        "mode": "fallback_slice",
                        "first_word_start_ms": start_ms,
                        "last_word_end_ms": end_ms,
                        "lead_padding_ms": 0,
                        "tail_padding_ms": 0,
                    },
                }
            )

    candidates.sort(
        key=lambda c: (
            float(c.get("engagement_rate", 0) or 0),
            float(c.get("hook_score", 0) or 0),
            float(c.get("end_score", 0) or 0),
        ),
        reverse=True,
    )
    for idx, candidate in enumerate(candidates, start=1):
        candidate["candidate_id"] = f"cand-{idx}"
    return candidates


def _truncate_for_prompt(value: str, max_chars: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= max_chars:
        return text
    clipped = text[: max_chars - 1].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return clipped + "..."


def _candidate_prompt_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    captions = [str(line) for line in candidate.get("captions", []) if str(line).strip()]
    transcript = " ".join(captions)
    chapter = candidate.get("chapter") if isinstance(candidate.get("chapter"), dict) else {}
    return {
        "candidate_id": str(candidate.get("candidate_id") or ""),
        "start_sec": round(int(candidate.get("start_ms", 0) or 0) / 1000.0, 2),
        "end_sec": round(int(candidate.get("end_ms", 0) or 0) / 1000.0, 2),
        "duration_sec": float(candidate.get("duration_sec", 0) or 0),
        "virality_score": float(candidate.get("engagement_rate", 0) or 0),
        "heuristic_score": float(candidate.get("heuristic_score", candidate.get("engagement_rate", 0)) or 0),
        "hook_score": float(candidate.get("hook_score", 0) or 0),
        "ending_score": float(candidate.get("end_score", 0) or 0),
        "score_breakdown": candidate.get("score_breakdown") if isinstance(candidate.get("score_breakdown"), dict) else {},
        "chapter": {
            "index": chapter.get("chapter_index"),
            "topic_keywords": chapter.get("topic_keywords", []),
        },
        "opening": _truncate_for_prompt(str(candidate.get("opening_text", "") or ""), 150),
        "ending": _truncate_for_prompt(str(candidate.get("ending_text", "") or ""), 150),
        "transcript": _truncate_for_prompt(transcript, 520),
    }


def _curate_llm_candidates(candidates: list[dict[str, Any]], limit: int = LLM_CANDIDATE_LIMIT) -> list[dict[str, Any]]:
    if len(candidates) <= limit:
        return candidates[:]

    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(candidate: dict[str, Any]) -> None:
        cid = str(candidate.get("candidate_id") or "")
        if cid and cid not in seen and len(selected) < limit:
            seen.add(cid)
            selected.append(candidate)

    for candidate in candidates[: max(10, int(limit * 0.65))]:
        add(candidate)

    hook_ranked = sorted(
        candidates,
        key=lambda c: (
            float(c.get("hook_score", 0) or 0) * 2.0
            + float(c.get("end_score", 0) or 0)
            + float(c.get("engagement_rate", 0) or 0) * 0.25
        ),
        reverse=True,
    )
    for candidate in hook_ranked:
        add(candidate)
        if len(selected) >= int(limit * 0.85):
            break

    chronological = sorted(candidates, key=lambda c: int(c.get("start_ms", 0) or 0))
    remaining = max(0, limit - len(selected))
    if remaining:
        step = max(1, math.floor(len(chronological) / remaining))
        for idx in range(0, len(chronological), step):
            add(chronological[idx])
            if len(selected) >= limit:
                break

    return sorted(selected, key=lambda c: int(c.get("start_ms", 0) or 0))


def _extract_json_payload(raw: str) -> Any:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty LLM response")
    if "```" in text:
        fenced = text.split("```")
        for part in fenced:
            cleaned = part.replace("json", "", 1).strip()
            if cleaned.startswith("{") or cleaned.startswith("["):
                text = cleaned
                break
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start_obj = text.find("{")
        end_obj = text.rfind("}")
        if start_obj >= 0 and end_obj > start_obj:
            return json.loads(text[start_obj : end_obj + 1])
        start_arr = text.find("[")
        end_arr = text.rfind("]")
        if start_arr >= 0 and end_arr > start_arr:
            return json.loads(text[start_arr : end_arr + 1])
        raise


def _overlaps_any(candidate: dict[str, Any], selected: list[dict[str, Any]]) -> bool:
    return any(
        not (
            int(candidate.get("end_ms", 0) or 0) <= int(pick.get("start_ms", 0) or 0)
            or int(candidate.get("start_ms", 0) or 0) >= int(pick.get("end_ms", 0) or 0)
        )
        for pick in selected
    )


def _rank_key(candidate: dict[str, Any]) -> tuple[float, float, float, float]:
    breakdown = candidate.get("score_breakdown") if isinstance(candidate.get("score_breakdown"), dict) else {}
    return (
        float(candidate.get("engagement_rate", 0) or 0),
        float(candidate.get("hook_score", 0) or 0),
        float(breakdown.get("standalone_coherence", 0) or 0),
        float(candidate.get("end_score", 0) or 0),
    )


def _resolve_target_count(candidates: list[dict[str, Any]], target_count: int) -> int:
    if target_count > 0:
        return max(1, min(int(target_count), MAX_AUTO_VIRAL_CLIPS))

    strong_non_overlapping: list[dict[str, Any]] = []
    for candidate in sorted(candidates, key=_rank_key, reverse=True):
        if float(candidate.get("engagement_rate", 0) or 0) < AUTO_MIN_VIRAL_SCORE:
            continue
        if _overlaps_any(candidate, strong_non_overlapping):
            continue
        strong_non_overlapping.append(candidate)
        if len(strong_non_overlapping) >= MAX_AUTO_VIRAL_CLIPS:
            break

    if strong_non_overlapping:
        return len(strong_non_overlapping)
    return min(MAX_AUTO_VIRAL_CLIPS, max(1, min(8, len(candidates))))


def _apply_ai_selection(
    parsed: Any,
    candidates: list[dict[str, Any]],
    target_count: int,
) -> list[dict[str, Any]]:
    id_map = {str(candidate.get("candidate_id") or ""): candidate for candidate in candidates}
    raw_items: Any
    if isinstance(parsed, dict):
        raw_items = parsed.get("shorts") or parsed.get("clips") or []
    else:
        raw_items = parsed
    if not isinstance(raw_items, list):
        return []

    selected: list[dict[str, Any]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        candidate_id = str(item.get("candidate_id") or item.get("id") or "").strip()
        source = id_map.get(candidate_id)
        if not source or _overlaps_any(source, selected):
            continue

        candidate = dict(source)
        caption_cues = candidate.get("caption_cues")
        if isinstance(caption_cues, list):
            candidate["caption_cues"] = [dict(cue) if isinstance(cue, dict) else cue for cue in caption_cues]

        title = str(item.get("title") or "").strip()
        primary_caption = str(item.get("primary_caption") or item.get("caption") or "").strip()
        reason = str(item.get("reason") or item.get("viral_reason") or "").strip()
        if title:
            candidate["title"] = _truncate_for_prompt(title, 68)
        if primary_caption:
            candidate["primary_caption"] = _truncate_for_prompt(primary_caption, 96)
        if reason:
            candidate["viral_reason"] = _truncate_for_prompt(reason, 220)

        try:
            ai_score = float(item.get("engagement_rate") or item.get("score") or candidate["engagement_rate"])
            candidate["engagement_rate"] = round(_clamp(ai_score, 65.0, 99.0), 1)
        except Exception:
            candidate["engagement_rate"] = max(float(candidate.get("engagement_rate", 0) or 0), 70.0)

        score_breakdown = item.get("score_breakdown")
        if isinstance(score_breakdown, dict):
            merged_breakdown = dict(candidate.get("score_breakdown") if isinstance(candidate.get("score_breakdown"), dict) else {})
            for key in (
                "hook_quality",
                "emotional_intensity",
                "topic_trend_alignment",
                "audio_engagement",
                "standalone_coherence",
                "filler_word_penalty",
                "mid_sentence_start_penalty",
                "visual_action",
            ):
                if score_breakdown.get(key) is None:
                    continue
                try:
                    merged_breakdown[key] = round(_clamp(float(score_breakdown[key]), 0.0, 100.0), 1)
                except Exception:
                    continue
            candidate["score_breakdown"] = merged_breakdown

        highlights = item.get("highlight_words")
        if isinstance(highlights, list):
            clean_highlights = [str(word).strip() for word in highlights if str(word).strip()][:4]
            candidate["ai_highlight_words"] = clean_highlights
            if clean_highlights and isinstance(candidate.get("caption_cues"), list):
                normalized = [(word, word.lower()) for word in clean_highlights]
                for cue in candidate["caption_cues"]:
                    if not isinstance(cue, dict):
                        continue
                    cue_text = str(cue.get("text", "") or "").lower()
                    matches = [word for word, low in normalized if low in cue_text]
                    if matches:
                        cue["highlight_words"] = matches[:2]

        candidate["selection_engine"] = "groq_viral_curation"
        candidate["assembly_mode"] = str(item.get("assembly_mode") or candidate.get("assembly_mode") or "continuous")
        selected.append(candidate)
        if len(selected) >= target_count:
            break

    return selected


def _format_candidate_shorts(
    selected: list[dict[str, Any]],
    *,
    target_aspect_ratio: str,
    caption_style: str,
    reframe_mode: str,
) -> list[dict[str, Any]]:
    selected = sorted(selected, key=_rank_key, reverse=True)
    output: list[dict[str, Any]] = []
    for idx, cand in enumerate(selected, start=1):
        item = {
            "short_id": f"short-{idx}",
            "title": str(cand.get("title") or "Short segment"),
            "start_ms": int(cand["start_ms"]),
            "end_ms": int(cand["end_ms"]),
            "duration_sec": float(cand["duration_sec"]),
            "engagement_rate": float(cand["engagement_rate"]),
            "primary_caption": str(cand.get("primary_caption") or ""),
            "captions": [str(line) for line in cand.get("captions", [])],
            "caption_cues": cand.get("caption_cues", []),
            "aspect_ratio": target_aspect_ratio,
            "caption_style": caption_style,
            "reframe_mode": reframe_mode,
        }
        if isinstance(cand.get("score_breakdown"), dict):
            item["score_breakdown"] = cand["score_breakdown"]
        if isinstance(cand.get("chapter"), dict):
            item["chapter"] = cand["chapter"]
        if isinstance(cand.get("source_segments"), list):
            item["source_segments"] = cand["source_segments"]
        if cand.get("assembly_mode"):
            item["assembly_mode"] = str(cand.get("assembly_mode") or "")
        if cand.get("viral_reason"):
            item["viral_reason"] = str(cand.get("viral_reason") or "")
        if cand.get("selection_engine"):
            item["selection_engine"] = str(cand.get("selection_engine") or "")
        if isinstance(cand.get("cut_quality"), dict):
            item["cut_quality"] = cand["cut_quality"]
        output.append(item)
    return output


def _select_heuristic_candidates(candidates: list[dict[str, Any]], target_count: int) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    ranked = sorted(candidates, key=_rank_key, reverse=True)
    for cand in ranked:
        if _overlaps_any(cand, selected):
            continue
        selected.append(cand)
        if len(selected) >= target_count:
            break

    if len(selected) < target_count:
        for cand in ranked:
            if cand in selected:
                continue
            selected.append(cand)
            if len(selected) >= target_count:
                break
    return selected


def _llm_select_viral_candidates(
    candidates: list[dict[str, Any]],
    *,
    target_count: int,
    min_duration_sec: int,
    max_duration_sec: int,
) -> list[dict[str, Any]]:
    from app.services.groq_service import get_groq_client

    llm_candidates = _curate_llm_candidates(candidates)
    payload = [_candidate_prompt_payload(candidate) for candidate in llm_candidates]
    system_prompt = (
        "You are Subtitlepro's Groq-powered viral curation editor. "
        "Think like a senior short-form producer: understand the full video chapters, then retrieve and rank moments by retention potential. "
        "Do not summarize the video. Pick only moments that can stand alone as finished shorts."
    )
    user_prompt = (
        "Select the best viral short candidates from the transcript windows below.\n\n"
        "Pipeline to follow:\n"
        "1. Full-video understanding: use chapter/topic metadata to avoid selecting repeated context or weak setup.\n"
        "2. ClipAnything-style signal review: evaluate hook quality, emotional intensity, topic/trend alignment, pacing/audio proxy, coherence, filler penalty, and mid-sentence risk.\n"
        "3. Virality Score: return a 0-100 score grounded in the supplied signal breakdown and your editorial judgment.\n"
        "4. Polish direction: choose highlight words that should get caption emphasis and emoji timing.\n\n"
        "Editorial rules:\n"
        "- The first 1-3 seconds must contain a hook: curiosity gap, bold claim, problem, number, contradiction, outcome, or direct promise.\n"
        "- The clip must be self-contained: setup, useful development, and payoff/conclusion.\n"
        "- Prefer transformation, mistakes, surprising facts, strong opinions, emotional stakes, examples, numbers, and practical takeaways.\n"
        "- Penalize greetings, generic introductions, repeated context, slow setup, filler, sentence fragments, and clips that end mid-thought.\n"
        "- End after the meaning is complete. Never choose a candidate whose ending depends on the next sentence.\n"
        f"- Respect the candidate timing. Duration must stay between {min_duration_sec}s and {max_duration_sec}s.\n"
        "- Current renderer supports one continuous source window per short. Do not invent non-contiguous timestamps in this response.\n"
        "- Return as many strong non-overlapping picks as possible up to the target. Rank them by hook and content strength.\n"
        "- Skip truly weak clips, but do not stop at 4-5 if the video contains more viral moments.\n\n"
        "Score each selected clip from 1-100 using this weighted rubric:\n"
        "- hook_quality: opens with tension, payoff promise, or curiosity.\n"
        "- emotional_intensity: surprise, stakes, confidence, controversy, joy, fear, or urgency.\n"
        "- topic_trend_alignment: relevance to creator/business/AI/social/fitness/productivity/trend language when present.\n"
        "- audio_engagement: speech pace proxy, energy proxy, no dead air.\n"
        "- standalone_coherence: makes sense without the rest of the video.\n"
        "- subtract filler_word_penalty and mid_sentence_start_penalty.\n\n"
        "Return STRICT JSON only with this shape:\n"
        '{"shorts":[{"candidate_id":"cand-1","rank":1,"title":"short title",'
        '"primary_caption":"caption for the opening frame","engagement_rate":94,'
        '"reason":"why this will retain viewers","highlight_words":["word","phrase"],'
        '"assembly_mode":"continuous","score_breakdown":{"hook_quality":92,'
        '"emotional_intensity":80,"topic_trend_alignment":72,"audio_engagement":84,'
        '"standalone_coherence":90,"filler_word_penalty":2,"mid_sentence_start_penalty":0,'
        '"visual_action":0}}]}\n\n'
        f"Target clips: {target_count}\n"
        f"Candidates:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    client = get_groq_client()
    response = client.chat.completions.create(
        model=VIRAL_SELECTION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.12,
        max_tokens=4096,
    )
    raw = str(response.choices[0].message.content or "").strip()
    parsed = _extract_json_payload(raw)
    selected = _apply_ai_selection(parsed, llm_candidates, target_count)
    for candidate in selected:
        candidate.setdefault("assembly_mode", "continuous")
    return selected


def build_viral_shorts_from_cues(
    cues: list[dict[str, Any]],
    target_count: int = AUTO_TARGET_COUNT,
    min_duration_sec: int = 15,
    max_duration_sec: int = 45,
    target_aspect_ratio: str = "9:16",
    caption_style: str = "comic_story",
    reframe_mode: str = "person_center",
) -> tuple[list[dict[str, Any]], str, list[str]]:
    """Build shorts with an LLM viral editor pass and a deterministic fallback."""
    candidates = _generate_viral_candidate_pool(
        cues,
        min_duration_sec=min_duration_sec,
        max_duration_sec=max_duration_sec,
    )
    if not candidates:
        return [], "none", ["No valid transcript windows were found for Long to Viral analysis."]

    requested_count = int(target_count or AUTO_TARGET_COUNT)
    resolved_target_count = _resolve_target_count(candidates, requested_count)
    warnings: list[str] = []
    try:
        ai_selected = _llm_select_viral_candidates(
            candidates,
            target_count=resolved_target_count,
            min_duration_sec=min_duration_sec,
            max_duration_sec=max_duration_sec,
        )
    except Exception as exc:
        logger.warning("AI viral selection failed; falling back to heuristic scoring: %s", exc)
        ai_selected = []
        warnings.append("AI viral selection was unavailable, so Subtitlepro used deterministic hook scoring.")

    if ai_selected:
        if len(ai_selected) < resolved_target_count:
            for candidate in sorted(candidates, key=_rank_key, reverse=True):
                if _overlaps_any(candidate, ai_selected):
                    continue
                filler = dict(candidate)
                filler["selection_engine"] = "heuristic_hook_scorer"
                filler["assembly_mode"] = "continuous"
                ai_selected.append(filler)
                if len(ai_selected) >= resolved_target_count:
                    break
        return (
            _format_candidate_shorts(
                ai_selected,
                target_aspect_ratio=target_aspect_ratio,
                caption_style=caption_style,
                reframe_mode=reframe_mode,
            ),
            "groq_viral_curation",
            warnings,
        )

    fallback = _select_heuristic_candidates(candidates, resolved_target_count)
    for candidate in fallback:
        candidate["selection_engine"] = "heuristic_hook_scorer"
        candidate["assembly_mode"] = "continuous"
    return (
        _format_candidate_shorts(
            fallback,
            target_aspect_ratio=target_aspect_ratio,
            caption_style=caption_style,
            reframe_mode=reframe_mode,
        ),
        "heuristic_hook_scorer",
        warnings,
    )


def build_shorts_from_cues(
    cues: list[dict[str, Any]],
    target_count: int = AUTO_TARGET_COUNT,
    min_duration_sec: int = 15,
    max_duration_sec: int = 45,
    target_aspect_ratio: str = "9:16",
    caption_style: str = "comic_story",
    reframe_mode: str = "person_center",
) -> list[dict[str, Any]]:
    if not cues:
        return []
    if target_count <= 0:
        target_count = MAX_AUTO_VIRAL_CLIPS

    ordered = sorted(
        [
            {
                "id": str(c.get("_id", "")),
                "text": str(c.get("text", "") or "").strip(),
                "start_ms": int(c.get("start_ms", 0) or 0),
                "end_ms": int(c.get("end_ms", 0) or 0),
                "words": c.get("words") if isinstance(c.get("words"), list) else [],
            }
            for c in cues
            if str(c.get("text", "") or "").strip()
        ],
        key=lambda c: (c["start_ms"], c["end_ms"]),
    )
    if not ordered:
        return []

    min_ms = max(5_000, int(min_duration_sec * 1000))
    max_ms = max(min_ms + 1000, int(max_duration_sec * 1000))
    total_end_ms = max(ordered[-1]["end_ms"], min_ms)

    candidates: list[dict[str, Any]] = []
    for i in range(len(ordered)):
        start_ms = max(0, ordered[i]["start_ms"])
        start_quality = _hook_score(ordered[i], ordered[i - 1] if i > 0 else None)
        window_cues: list[dict[str, Any]] = []
        end_ms = start_ms
        for j in range(i, len(ordered)):
            end_ms = max(end_ms, ordered[j]["end_ms"])
            window_cues.append(ordered[j])
            duration_ms = end_ms - start_ms
            if duration_ms < min_ms:
                continue
            if duration_ms > max_ms:
                break

            window_caps = [str(cue["text"]) for cue in window_cues]
            window_text = " ".join(window_caps).strip()
            if len(window_text) < 24:
                continue

            duration_sec = duration_ms / 1000.0
            next_cue = ordered[j + 1] if j + 1 < len(ordered) else None
            ending_quality = _end_score(ordered[j], next_cue)
            score = _score_candidate(
                text=window_text,
                duration_sec=duration_sec,
                start_ratio=start_ms / max(1, total_end_ms),
                cue_count=(j - i + 1),
                hook_score=start_quality,
                end_score=ending_quality,
            )
            primary_caption = _build_caption_summary(window_caps[:2], max_chars=92)
            title = _build_caption_summary([window_text], max_chars=64)
            final_end_ms = _tail_padded_end_ms(end_ms, next_cue, total_end_ms)
            candidates.append(
                {
                    "start_ms": start_ms,
                    "end_ms": final_end_ms,
                    "content_end_ms": end_ms,
                    "duration_sec": round((final_end_ms - start_ms) / 1000.0, 2),
                    "engagement_rate": round(score, 1),
                    "primary_caption": primary_caption,
                    "title": title if title else "Short segment",
                    "captions": window_caps[:],
                    "caption_cues": _clip_caption_cues(window_cues, start_ms, final_end_ms),
                    "hook_score": round(start_quality, 2),
                    "end_score": round(ending_quality, 2),
                }
            )

            punct = ordered[j]["text"][-1:] if ordered[j]["text"] else ""
            clean_end = ending_quality >= 7.0 or punct in {".", "!", "?"}
            if clean_end:
                break

    if not candidates:
        # Fallback: build evenly-spaced slices
        total_start = ordered[0]["start_ms"]
        total_span = max(min_ms, ordered[-1]["end_ms"] - total_start)
        chunk_ms = max(min_ms, min(max_ms, math.ceil(total_span / max(1, target_count))))
        for idx in range(max(1, target_count)):
            start_ms = total_start + idx * chunk_ms
            if start_ms >= ordered[-1]["end_ms"]:
                break
            end_ms = min(start_ms + chunk_ms, ordered[-1]["end_ms"])
            cap_cues = [
                c
                for c in ordered
                if c["start_ms"] < end_ms and c["end_ms"] > start_ms
            ]
            cap_lines = [str(c["text"]) for c in cap_cues]
            if not cap_lines:
                continue
            text = " ".join(cap_lines)
            duration_sec = (end_ms - start_ms) / 1000.0
            candidates.append(
                {
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "duration_sec": round(duration_sec, 2),
                    "engagement_rate": round(_score_candidate(text, duration_sec, start_ms / max(1, total_end_ms), len(cap_lines)), 1),
                    "primary_caption": _build_caption_summary(cap_lines[:2], max_chars=92),
                    "title": _build_caption_summary([text], max_chars=64) or "Short segment",
                    "captions": cap_lines,
                    "caption_cues": _clip_caption_cues(cap_cues, start_ms, end_ms),
                }
            )

    candidates.sort(key=lambda c: c["engagement_rate"], reverse=True)

    selected: list[dict[str, Any]] = []
    for cand in candidates:
        overlaps = any(
            not (cand["end_ms"] <= pick["start_ms"] or cand["start_ms"] >= pick["end_ms"])
            for pick in selected
        )
        if overlaps:
            continue
        selected.append(cand)
        if len(selected) >= target_count:
            break

    if len(selected) < target_count:
        for cand in candidates:
            if cand in selected:
                continue
            selected.append(cand)
            if len(selected) >= target_count:
                break

    selected.sort(
        key=lambda c: (
            float(c.get("engagement_rate", 0) or 0),
            float(c.get("hook_score", 0) or 0),
            float(c.get("end_score", 0) or 0),
        ),
        reverse=True,
    )
    output: list[dict[str, Any]] = []
    for idx, cand in enumerate(selected, start=1):
        output.append(
            {
                "short_id": f"short-{idx}",
                "title": cand["title"],
                "start_ms": int(cand["start_ms"]),
                "end_ms": int(cand["end_ms"]),
                "duration_sec": float(cand["duration_sec"]),
                "engagement_rate": float(cand["engagement_rate"]),
                "primary_caption": cand["primary_caption"],
                "captions": [str(line) for line in cand["captions"]],
                "caption_cues": cand.get("caption_cues", []),
                "aspect_ratio": target_aspect_ratio,
                "caption_style": caption_style,
                "reframe_mode": reframe_mode,
            }
        )

    return output
