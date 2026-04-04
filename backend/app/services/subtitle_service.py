"""Subtitle conversion and export service."""
from typing import Any, Dict, List


def segments_to_cues(
    segments: List[Dict[str, Any]],
    track_id: str = "",
) -> List[Dict[str, Any]]:
    """Convert Whisper segments to SubtitleCue documents.

    Each segment has: start (seconds), end (seconds), text
    Returns list of cue dicts ready for MongoDB insertion.
    """
    cues = []
    for i, seg in enumerate(segments):
        cues.append({
            "track_id": track_id,
            "sequence": i + 1,
            "start_ms": int(seg["start"] * 1000),
            "end_ms": int(seg["end"] * 1000),
            "text": seg["text"].strip(),
            "speaker_id": seg.get("speaker_id"),
            "confidence": seg.get("confidence"),
            "line_position": "bottom",
        })
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
