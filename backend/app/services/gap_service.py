"""Gap Cutting Agent — detect silence gaps in a media file via FFmpeg silencedetect.

Returns a list of silence periods suitable for auto-cut suggestions in the editor timeline.
"""
import asyncio
import logging
import re

logger = logging.getLogger(__name__)


async def detect_silence_gaps(
    file_path: str,
    noise_db: float = -35.0,
    min_gap_ms: int = 500,
) -> list[dict]:
    """Detect silence gaps in *file_path*.

    Args:
        file_path:   Path to the local media file.
        noise_db:    Silence noise floor in dBFS (default -35 dB).
        min_gap_ms:  Minimum silence duration in milliseconds (default 500 ms).

    Returns:
        List of dicts with keys ``start_ms``, ``end_ms``, ``duration_ms``, ``type``.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", file_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_gap_ms / 1000:.3f}",
        "-f", "null", "-",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
    except FileNotFoundError:
        logger.error("FFmpeg not found. Install ffmpeg and ensure it is in PATH.")
        return []
    except Exception as e:
        logger.error(f"Error running silencedetect on {file_path}: {e}")
        return []

    output = stderr.decode(errors="replace")
    return _parse_silence_output(output)


def _parse_silence_output(stderr: str) -> list[dict]:
    gaps: list[dict] = []
    starts = re.findall(r"silence_start:\s*([\d.]+)", stderr)
    ends = re.findall(r"silence_end:\s*([\d.]+)", stderr)

    for s, e in zip(starts, ends):
        start_ms = int(float(s) * 1000)
        end_ms = int(float(e) * 1000)
        gaps.append({
            "start_ms": start_ms,
            "end_ms": end_ms,
            "duration_ms": end_ms - start_ms,
            "type": "silence",
        })

    logger.info(f"Detected {len(gaps)} silence gap(s).")
    return gaps
