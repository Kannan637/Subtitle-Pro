"""Subtitle conversion and export service."""
import re
from typing import Any, Dict, List

MAX_CHARS_PER_CUE = 42
MAX_WORDS_PER_CUE = 8
MAX_CUE_DURATION_MS = 3600
MIN_CUE_DURATION_MS = 650
READING_SPEED_CPS = 17


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _split_long_text(text: str) -> List[str]:
    """Split segment text into readable subtitle phrases."""
    words = _clean_text(text).split()
    if not words:
        return []

    chunks: List[str] = []
    current: List[str] = []

    def flush() -> None:
        nonlocal current
        if current:
            chunks.append(" ".join(current).strip())
            current = []

    for word in words:
        candidate = " ".join([*current, word]).strip()
        current_too_long = len(candidate) > MAX_CHARS_PER_CUE or len(current) >= MAX_WORDS_PER_CUE
        if current and current_too_long:
            flush()
            candidate = word

        current.append(word)
        if re.search(r"[.!?;:]$", word) and len(" ".join(current)) >= 18:
            flush()

    flush()
    return chunks


def _allocate_timings(start_ms: int, end_ms: int, chunks: List[str]) -> List[tuple[int, int]]:
    """Allocate cue timings inside the original Whisper segment.

    Audio sync is more important than readability. This function never expands a
    segment beyond Whisper's end time, because doing so pushes every following
    cue late and makes captions visibly mismatch the audio.
    """
    if not chunks:
        return []

    duration = max(end_ms - start_ms, 1)
    weights = [max(1, len(chunk)) for chunk in chunks]
    weight_total = sum(weights)

    timings: List[tuple[int, int]] = []
    cursor = start_ms
    for index, weight in enumerate(weights):
        if index == len(weights) - 1:
            chunk_end = end_ms
        else:
            share = max(1, round(duration * (weight / weight_total)))
            max_end_for_remaining = end_ms - (len(weights) - index - 1)
            chunk_end = min(cursor + share, max_end_for_remaining)
            chunk_end = max(chunk_end, cursor + 1)
        timings.append((cursor, chunk_end))
        cursor = chunk_end

    return timings


def _word_timing_ms(word: Dict[str, Any], key_ms: str, key_s: str) -> int | None:
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


def _segment_words_to_ms(seg: Dict[str, Any], start_ms: int, end_ms: int) -> List[Dict[str, Any]]:
    raw_words = seg.get("words")
    if not isinstance(raw_words, list):
        return []

    words: List[Dict[str, Any]] = []
    for item in raw_words:
        if not isinstance(item, dict):
            continue
        token = _clean_text(str(item.get("word") or item.get("text") or item.get("token") or ""))
        if not token:
            continue
        word_start = _word_timing_ms(item, "start_ms", "start")
        word_end = _word_timing_ms(item, "end_ms", "end")
        if word_start is None or word_end is None:
            continue
        if word_end <= word_start:
            word_end = word_start + max(90, min(420, len(token) * 55))

        clipped_start = max(start_ms, word_start)
        clipped_end = min(end_ms, word_end)
        if clipped_end <= clipped_start:
            continue
        words.append({
            "word": token,
            "start_ms": clipped_start,
            "end_ms": clipped_end,
        })

    return sorted(words, key=lambda item: (item["start_ms"], item["end_ms"]))


def _allocate_word_timed_chunks(
    start_ms: int,
    end_ms: int,
    chunks: List[str],
    words: List[Dict[str, Any]],
) -> tuple[List[tuple[int, int]], List[List[Dict[str, Any]]]]:
    fallback_timings = _allocate_timings(start_ms, end_ms, chunks)
    if not chunks or not words:
        return fallback_timings, [[] for _ in chunks]

    timings: List[tuple[int, int]] = []
    chunk_words: List[List[Dict[str, Any]]] = []
    cursor = 0
    for index, chunk in enumerate(chunks):
        expected_count = max(1, len(_clean_text(chunk).split()))
        assigned = words[cursor:cursor + expected_count]
        cursor += expected_count

        if assigned:
            cue_start = max(start_ms, int(assigned[0]["start_ms"]))
            cue_end = min(end_ms, int(assigned[-1]["end_ms"]))
            if cue_end <= cue_start:
                cue_start, cue_end = fallback_timings[index]
            timings.append((cue_start, cue_end))
            chunk_words.append(assigned)
        else:
            timings.append(fallback_timings[index])
            chunk_words.append([])

    return timings, chunk_words


def segments_to_cues(
    segments: List[Dict[str, Any]],
    track_id: str = "",
) -> List[Dict[str, Any]]:
    """Convert Whisper segments to SubtitleCue documents.

    Each segment has: start (seconds), end (seconds), text
    Returns list of cue dicts ready for MongoDB insertion.
    """
    cues = []
    sequence = 1

    for seg in segments:
        text = _clean_text(str(seg.get("text", "")))
        if not text:
            continue

        start_ms = max(0, int(float(seg.get("start", 0) or 0) * 1000))
        raw_end_ms = int(float(seg.get("end", 0) or 0) * 1000)
        if raw_end_ms <= start_ms:
            raw_end_ms = start_ms + max(MIN_CUE_DURATION_MS, int(len(text) / READING_SPEED_CPS * 1000))

        chunks = _split_long_text(text)
        segment_words = _segment_words_to_ms(seg, start_ms, raw_end_ms)
        timings, chunk_words = _allocate_word_timed_chunks(start_ms, raw_end_ms, chunks, segment_words)

        for index, (chunk, (cue_start, cue_end)) in enumerate(zip(chunks, timings)):
            cue_doc = {
                "track_id": track_id,
                "sequence": sequence,
                "start_ms": cue_start,
                "end_ms": cue_end,
                "text": chunk,
                "speaker_id": seg.get("speaker_id"),
                "confidence": seg.get("confidence"),
                "line_position": "bottom",
            }
            if index < len(chunk_words) and chunk_words[index]:
                cue_doc["words"] = chunk_words[index]
            cues.append(cue_doc)
            sequence += 1

    return cues


def format_timestamp_srt(ms: int) -> str:
    """Convert milliseconds to SRT timestamp: HH:MM:SS,mmm"""
    hours = ms // 3_600_000
    minutes = (ms % 3_600_000) // 60_000
    seconds = (ms % 60_000) // 1_000
    millis = ms % 1_000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def format_timestamp_vtt(ms: int) -> str:
    """Convert milliseconds to VTT timestamp: HH:MM:SS.mmm"""
    hours = ms // 3_600_000
    minutes = (ms % 3_600_000) // 60_000
    seconds = (ms % 60_000) // 1_000
    millis = ms % 1_000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def export_srt(cues: List[Dict[str, Any]]) -> str:
    """Export subtitle cues as SRT format string."""
    lines = []
    sorted_cues = sorted(cues, key=lambda c: c.get("sequence", 0))
    for i, cue in enumerate(sorted_cues, 1):
        start = format_timestamp_srt(cue["start_ms"])
        end = format_timestamp_srt(cue["end_ms"])
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(cue["text"])
        lines.append("")  # blank line separator
    return "\n".join(lines)


def export_vtt(cues: List[Dict[str, Any]]) -> str:
    """Export subtitle cues as WebVTT format string."""
    lines = ["WEBVTT", ""]
    sorted_cues = sorted(cues, key=lambda c: c.get("sequence", 0))
    for i, cue in enumerate(sorted_cues, 1):
        start = format_timestamp_vtt(cue["start_ms"])
        end = format_timestamp_vtt(cue["end_ms"])
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(cue["text"])
        lines.append("")
    return "\n".join(lines)


def export_txt(cues: List[Dict[str, Any]]) -> str:
    """Export subtitle cues as plain text."""
    sorted_cues = sorted(cues, key=lambda c: c.get("sequence", 0))
    return "\n".join(cue["text"] for cue in sorted_cues)


def export_json(cues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Export subtitle cues as clean JSON list."""
    sorted_cues = sorted(cues, key=lambda c: c.get("sequence", 0))
    return [
        {
            "sequence": cue.get("sequence", i),
            "start_ms": cue["start_ms"],
            "end_ms": cue["end_ms"],
            "text": cue["text"],
            "speaker_id": cue.get("speaker_id"),
        }
        for i, cue in enumerate(sorted_cues, 1)
    ]
