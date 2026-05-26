"""Groq AI service — Whisper transcription + LLM translation."""
import logging
import os
import json
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client singleton
# ---------------------------------------------------------------------------
_client: Optional[Groq] = None


def get_groq_client() -> Groq:
    """Return a reusable Groq client instance."""
    global _client
    if _client is None:
        api_key = settings.groq_api_key
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file. "
                "Get a key from https://console.groq.com"
            )
        _client = Groq(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# Transcription (Whisper)
# ---------------------------------------------------------------------------
def _probe_duration_seconds(file_path: str) -> float:
    """Best-effort media duration probe used when the API omits duration."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15, check=True)
        return max(0.0, float(result.stdout.strip()))
    except Exception:
        return 0.0


def _field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _has_field(obj: Any, name: str) -> bool:
    if isinstance(obj, dict):
        return name in obj
    return hasattr(obj, name)


def _coerce_word_items(raw_words: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_words, list):
        return []

    words: List[Dict[str, Any]] = []
    for item in raw_words:
        token = str(_field(item, "word", _field(item, "text", "")) or "").strip()
        if not token:
            continue
        try:
            start = float(_field(item, "start", _field(item, "start_ms", 0)) or 0)
            end = float(_field(item, "end", _field(item, "end_ms", 0)) or 0)
        except Exception:
            continue

        if _has_field(item, "start_ms"):
            start = start / 1000.0
        if _has_field(item, "end_ms"):
            end = end / 1000.0
        if end <= start:
            continue
        words.append({"word": token, "start": start, "end": end})

    return words


def _words_for_segment(words: List[Dict[str, Any]], start: float, end: float) -> List[Dict[str, Any]]:
    if not words:
        return []
    segment_words: List[Dict[str, Any]] = []
    for word in words:
        word_start = float(word.get("start", 0) or 0)
        word_end = float(word.get("end", 0) or 0)
        midpoint = word_start + ((word_end - word_start) / 2.0)
        if start <= midpoint <= end or (word_start < end and word_end > start):
            segment_words.append(word)
    return segment_words


def transcribe_audio(
    file_path: str,
    language: Optional[str] = None,
    model: str = "whisper-large-v3-turbo",
) -> Dict[str, Any]:
    """Transcribe an audio file using Groq Whisper API.

    Returns dict with:
        - text: full transcript
        - segments: list of {start, end, text} dicts
        - language: detected language code
        - duration: audio duration in seconds
    """
    client = get_groq_client()

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    file_ext = os.path.splitext(file_path)[1].lower()
    video_exts = {".mp4", ".mkv", ".mov", ".avi", ".webm"}

    target_file = file_path
    temp_file_path = None

    # If file is a video or larger than 20MB, extract/compress to MP3
    if file_ext in video_exts or file_size_mb > 20:
        logger.info(f"File {file_path} is {file_size_mb:.1f}MB or video. Compressing via ffmpeg...")
        fd, temp_file_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        
        # Extract audio, convert to 16kHz mono 32kbps mp3 (approx 14MB per hour)
        cmd = [
            "ffmpeg", "-y", "-i", file_path, 
            "-vn", "-acodec", "libmp3lame", 
            "-ar", "16000", "-ac", "1", "-b:a", "32k", 
            temp_file_path
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            target_file = temp_file_path
            new_size = os.path.getsize(target_file) / (1024 * 1024)
            logger.info(f"Compression successful. New size: {new_size:.1f}MB")
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg compression failed: {e}")
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            # Fallback to original
            target_file = file_path

    # Check hard limit before sending
    final_size_mb = os.path.getsize(target_file) / (1024 * 1024)
    if final_size_mb > 25:
        raise RuntimeError(f"File size {final_size_mb:.1f}MB exceeds Groq's 25MB limit even after compression.")

    filename = os.path.basename(target_file)

    try:
        with open(target_file, "rb") as audio_file:
            kwargs: Dict[str, Any] = {
                "file": (filename, audio_file.read()),
                "model": model,
                "response_format": "verbose_json",
                "temperature": 0.0,
            }
            if language and language != "auto":
                kwargs["language"] = language

            try:
                transcription = client.audio.transcriptions.create(
                    **{**kwargs, "timestamp_granularities": ["segment", "word"]}
                )
            except Exception as exc:
                message = str(exc).lower()
                if not any(
                    token in message
                    for token in ("timestamp", "granularit", "unexpected keyword", "extra_forbidden", "unknown field", "unrecognized")
                ):
                    raise
                logger.info("Groq word timestamp request was not accepted; retrying segment timestamps only.")
                transcription = client.audio.transcriptions.create(**kwargs)
    finally:
        # Cleanup temporary compressed file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to remove temp file {temp_file_path}: {e}")

    # Parse verbose_json response
    duration = float(getattr(transcription, "duration", 0) or 0)
    if duration <= 0:
        duration = _probe_duration_seconds(file_path)

    result: Dict[str, Any] = {
        "text": transcription.text,
        "language": getattr(transcription, "language", language or "en"),
        "duration": duration,
        "segments": [],
    }

    # Extract Whisper segments with timestamps. Subtitle chunking happens in
    # subtitle_service so we preserve phrase context instead of emitting one cue
    # per interpolated word.
    top_level_words = _coerce_word_items(_field(transcription, "words", []))
    raw_segments = getattr(transcription, "segments", [])
    if isinstance(raw_segments, list):
        for seg in raw_segments:
            if isinstance(seg, dict):
                start = seg.get("start", 0)
                end = seg.get("end", 0)
                text = seg.get("text", "").strip()
            else:
                start = getattr(seg, "start", 0)
                end = getattr(seg, "end", 0)
                text = getattr(seg, "text", "").strip()
            if not text:
                continue

            start_s = float(start or 0)
            end_s = float(end or 0)
            words = _coerce_word_items(_field(seg, "words", []))
            if not words:
                words = _words_for_segment(top_level_words, start_s, end_s)

            segment: Dict[str, Any] = {
                "start": float(start or 0),
                "end": float(end or 0),
                "text": text,
                "confidence": seg.get("avg_logprob") if isinstance(seg, dict) else getattr(seg, "avg_logprob", None),
            }
            if words:
                segment["words"] = words
            result["segments"].append(segment)

    if not result["segments"] and result["text"]:
        result["segments"].append({
            "start": 0.0,
            "end": duration or max(1.0, len(result["text"].split()) * 0.35),
            "text": result["text"].strip(),
        })

    logger.info(
        f"Transcription complete: {len(result['segments'])} segments, "
        f"duration={result['duration']:.1f}s, lang={result['language']}"
    )
    return result


# ---------------------------------------------------------------------------
# Translation (LLM)
# ---------------------------------------------------------------------------
LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "ja": "Japanese", "ko": "Korean", "zh": "Chinese", "hi": "Hindi",
    "ar": "Arabic", "pt": "Portuguese", "ru": "Russian", "it": "Italian",
    "nl": "Dutch", "tr": "Turkish", "th": "Thai", "vi": "Vietnamese",
    "pl": "Polish", "sv": "Swedish", "da": "Danish", "fi": "Finnish",
    "no": "Norwegian", "cs": "Czech", "ro": "Romanian", "hu": "Hungarian",
    "el": "Greek", "he": "Hebrew", "id": "Indonesian", "ms": "Malay",
    "uk": "Ukrainian", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
}


def translate_subtitles(
    cues: List[Dict[str, Any]],
    source_lang: str,
    target_lang: str,
    tone: str = "neutral",
    model: str = "llama-3.3-70b-versatile",
) -> List[Dict[str, Any]]:
    """Translate a list of subtitle cues using Groq LLM.

    Each cue dict must have: text, start_ms, end_ms, sequence
    Returns the same list with translated text.
    """
    client = get_groq_client()

    source_name = LANGUAGE_NAMES.get(source_lang, source_lang)
    target_name = LANGUAGE_NAMES.get(target_lang, target_lang)

    # Build text block for batch translation (more efficient)
    numbered_lines = []
    for i, cue in enumerate(cues):
        numbered_lines.append(f"{i}|{cue['text']}")
    text_block = "\n".join(numbered_lines)

    system_prompt = f"""You are a professional subtitle translator. Translate the following subtitle lines from {source_name} to {target_name}.

Rules:
- Translate naturally, preserving meaning and tone ({tone} style)
- Keep each line concise (max 42 characters per line when possible)
- Preserve the line numbering format: NUMBER|TRANSLATED_TEXT
- Do NOT add any extra text, explanations, or formatting
- Each line must start with its original number followed by |
- Translate ALL lines, do not skip any"""

    # Chunk if too many cues (stay within context window)
    CHUNK_SIZE = 50
    translated_cues = []

    for chunk_start in range(0, len(cues), CHUNK_SIZE):
        chunk_cues = cues[chunk_start:chunk_start + CHUNK_SIZE]
        chunk_lines = []
        for i, cue in enumerate(chunk_cues):
            chunk_lines.append(f"{chunk_start + i}|{cue['text']}")
        chunk_text = "\n".join(chunk_lines)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": chunk_text},
            ],
            temperature=0.3,
            max_tokens=4096,
        )

        translated_text = response.choices[0].message.content.strip()

        # Parse response back into cues
        for line in translated_text.split("\n"):
            line = line.strip()
            if "|" not in line:
                continue
            parts = line.split("|", 1)
            try:
                idx = int(parts[0].strip())
                text = parts[1].strip()
                if 0 <= idx < len(cues):
                    translated_cue = cues[idx].copy()
                    translated_cue["text"] = text
                    translated_cues.append(translated_cue)
            except (ValueError, IndexError):
                continue

    # If some cues were missed, fill with originals
    if len(translated_cues) < len(cues):
        translated_set = {c.get("sequence", i) for i, c in enumerate(translated_cues)}
        for i, cue in enumerate(cues):
            seq = cue.get("sequence", i)
            if seq not in translated_set:
                translated_cues.append(cue.copy())
        translated_cues.sort(key=lambda c: c.get("sequence", 0))

    logger.info(f"Translation complete: {len(translated_cues)} cues, {source_lang} → {target_lang}")
    return translated_cues
