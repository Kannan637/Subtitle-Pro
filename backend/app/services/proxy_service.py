"""Proxy video generation using FFmpeg.

Converts any uploaded video to a lightweight 640×360 proxy for in-browser editing.
The proxy is H.264 ultrafast / AAC 64k with +faststart for instant streaming start.
On export the backend re-applies all edits to the original full-quality file.
"""
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

PROXY_DIR = "uploads/proxies"
os.makedirs(PROXY_DIR, exist_ok=True)


async def generate_proxy(original_path: str, project_id: str) -> str | None:
    """Generate a 640×360 proxy from *original_path*.

    Returns the proxy file path on success, or ``None`` if FFmpeg fails.
    Skips generation if a proxy already exists.
    """
    proxy_path = os.path.join(PROXY_DIR, f"{project_id}_proxy.mp4")

    if os.path.exists(proxy_path):
        logger.info(f"Proxy already exists for project {project_id}, skipping generation.")
        return proxy_path

    cmd = [
        "ffmpeg", "-y",
        "-i", original_path,
        "-vf", "scale=640:360:force_original_aspect_ratio=decrease",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32",
        "-c:a", "aac", "-b:a", "64k",
        "-movflags", "+faststart",
        proxy_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(
                f"FFmpeg proxy generation failed for project {project_id}: "
                f"{stderr.decode(errors='replace')[-500:]}"
            )
            return None

        logger.info(f"Proxy generated for project {project_id}: {proxy_path}")
        return proxy_path
    except FileNotFoundError:
        logger.error("FFmpeg not found. Install ffmpeg and ensure it is in PATH.")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during proxy generation for {project_id}: {e}")
        return None
