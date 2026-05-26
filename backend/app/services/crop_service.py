"""Aspect ratio conversion service for 16:9 and 9:16 outputs."""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Literal, Optional

from app.services.groq_service import get_groq_client
from app.services.reframe_service import (
    AutoCenterFallbackRequired,
    AutoCenterUnavailable,
    auto_center_video,
)

logger = logging.getLogger(__name__)

_RATIO_MAP: dict[str, tuple[int, int]] = {
    "16:9": (16, 9),
    "9:16": (9, 16),
}


async def crop_video(
    input_path: str,
    output_path: str,
    target_ratio: Literal["16:9", "9:16"],
    subject_x_pct: Optional[float] = None,
    fit_mode: Literal["auto", "person_crop", "fit_blur_bg"] = "auto",
) -> dict:
    if target_ratio not in _RATIO_MAP:
        raise ValueError(f"Unsupported target ratio: {target_ratio!r}")

    src_w, src_h = await _probe_dimensions(input_path)
    if src_w <= 0 or src_h <= 0:
        raise RuntimeError(f"Could not probe dimensions from {input_path!r}")

    if fit_mode == "person_crop" and target_ratio == "9:16" and subject_x_pct is None:
        try:
            result = await auto_center_video(input_path, output_path, target_ratio)
            logger.info(
                "crop_video: %s -> %s (%dx%d), ratio=%s, method=%s",
                os.path.basename(input_path),
                os.path.basename(output_path),
                int(result.get("width", 0)),
                int(result.get("height", 0)),
                target_ratio,
                result.get("method"),
            )
            return result
        except AutoCenterFallbackRequired as exc:
            logger.info("MediaPipe auto-center selected fit fallback: %s", exc.reason)
            filter_type, filter_str, out_w, out_h = _build_smart_fit_filter(src_w, src_h, target_ratio)
            await _run_ffmpeg_reframe(input_path, output_path, filter_str, use_filter_complex=True)
            profile = exc.profile
            return {
                "output_path": output_path,
                "width": out_w,
                "height": out_h,
                "subject_x_pct": float(profile.get("subject_x_pct", 0.5)),
                "method": filter_type,
                "fit_mode": "fit_blur_bg",
                "fallback_reason": exc.reason,
                "subject_spread": float(profile.get("spread", 0.0) or 0.0),
                "edge_hits": int(profile.get("edge_hits", 0) or 0),
                "detection_rate": float(profile.get("detection_rate", 0.0) or 0.0),
            }
        except AutoCenterUnavailable as exc:
            logger.warning("MediaPipe auto-center unavailable; using static crop fallback: %s", exc)
        except Exception as exc:
            logger.warning("MediaPipe auto-center failed; using static crop fallback: %s", exc)

    subject_profile: dict[str, float | int] | None = None
    if subject_x_pct is None:
        subject_profile = await _detect_subject_profile(input_path)
        subject_x_pct = float(subject_profile.get("center", 0.5))

    prefer_smart_fit = fit_mode == "fit_blur_bg" or (
        fit_mode == "auto"
        and _should_use_smart_fit(
            src_w=src_w,
            src_h=src_h,
            target_ratio=target_ratio,
            profile=subject_profile,
        )
    )

    filter_type, filter_str, out_w, out_h = _build_reframe_filter(
        src_w=src_w,
        src_h=src_h,
        target_ratio=target_ratio,
        subject_x_pct=subject_x_pct,
        prefer_smart_fit=prefer_smart_fit,
    )
    await _run_ffmpeg_reframe(input_path, output_path, filter_str, use_filter_complex=filter_type == "smart_fit")

    logger.info(
        "crop_video: %s -> %s (%dx%d), ratio=%s, method=%s",
        os.path.basename(input_path),
        os.path.basename(output_path),
        out_w,
        out_h,
        target_ratio,
        filter_type,
    )
    return {
        "output_path": output_path,
        "width": out_w,
        "height": out_h,
        "subject_x_pct": subject_x_pct,
        "method": filter_type,
        "fit_mode": "fit_blur_bg" if filter_type == "smart_fit" else "person_crop",
        "subject_spread": float(subject_profile.get("spread", 0.0)) if subject_profile else 0.0,
        "edge_hits": int(subject_profile.get("edge_hits", 0)) if subject_profile else 0,
    }


async def _probe_dimensions(path: str) -> tuple[int, int]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    out, _ = await proc.communicate()
    parts = out.decode().strip().split(",")
    if len(parts) != 2:
        return 0, 0
    try:
        return int(parts[0]), int(parts[1])
    except Exception:
        return 0, 0


async def _probe_duration_seconds(path: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0:
        return 0.0
    try:
        return max(0.0, float((out or b"0").decode().strip() or 0.0))
    except Exception:
        return 0.0


def _parse_subject_x(raw: str) -> float:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty response")
    try:
        value = float(text)
        return max(0.0, min(1.0, value))
    except Exception:
        pass

    match = re.search(r"(-?\d+(?:\.\d+)?)", text)
    if not match:
        raise ValueError(f"no float found in {text!r}")
    value = float(match.group(1))
    return max(0.0, min(1.0, value))


async def _estimate_subject_center_from_frame(path: str, timestamp_sec: float) -> float:
    thumb_path = f"{path}.thumb.{int(timestamp_sec * 1000)}.jpg"
    try:
        extract_cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{max(0.0, timestamp_sec):.3f}",
            "-i",
            path,
            "-vframes",
            "1",
            "-vf",
            "scale=640:-2",
            "-q:v",
            "3",
            thumb_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *extract_cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.communicate()
        if not os.path.exists(thumb_path):
            raise RuntimeError("thumbnail extraction failed")

        import base64

        with open(thumb_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()

        client = get_groq_client()
        resp = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {
                        "type": "text",
                        "text": (
                            "Return one float from 0.0 to 1.0 for the main person's horizontal center. "
                            "0.0=left, 0.5=center, 1.0=right. If unclear return 0.5. "
                            "Return only the number."
                        ),
                    },
                ],
            }],
            temperature=0.0,
            max_tokens=16,
        )
        raw = (resp.choices[0].message.content or "").strip()
        return _parse_subject_x(raw)
    finally:
        if os.path.exists(thumb_path):
            try:
                os.remove(thumb_path)
            except OSError:
                pass


async def _detect_subject_profile(path: str) -> dict[str, float | int]:
    try:
        duration = await _probe_duration_seconds(path)
        upper = max(0.0, duration - 0.2)
        sample_points = [0.4, duration * 0.35, duration * 0.72]
        timestamps: list[float] = []
        for value in sample_points:
            ts = max(0.0, min(upper, value))
            if not timestamps or abs(timestamps[-1] - ts) > 0.15:
                timestamps.append(ts)
        if not timestamps:
            timestamps = [0.0]

        estimates: list[float] = []
        for ts in timestamps:
            try:
                estimates.append(await _estimate_subject_center_from_frame(path, ts))
            except Exception as frame_exc:
                logger.debug("subject center estimation failed at %.2fs: %s", ts, frame_exc)

        if not estimates:
            return {"center": 0.5, "spread": 0.0, "edge_hits": 0, "count": 0}
        ordered = sorted(estimates)
        center = ordered[len(ordered) // 2]
        spread = max(ordered) - min(ordered)
        edge_hits = sum(1 for value in ordered if value <= 0.16 or value >= 0.84)
        return {
            "center": center,
            "spread": spread,
            "edge_hits": edge_hits,
            "count": len(ordered),
        }
    except Exception as exc:
        logger.warning("subject detect fallback to center: %s", exc)
        return {"center": 0.5, "spread": 0.0, "edge_hits": 0, "count": 0}


async def _detect_subject_x(path: str) -> float:
    profile = await _detect_subject_profile(path)
    return float(profile.get("center", 0.5))


def _round_even(value: float) -> int:
    n = int(round(value))
    return n if n % 2 == 0 else n - 1


def _build_reframe_filter(
    src_w: int,
    src_h: int,
    target_ratio: str,
    subject_x_pct: float,
    prefer_smart_fit: bool = False,
) -> tuple[Literal["subject_crop", "smart_fit"], str, int, int]:
    if prefer_smart_fit:
        return _build_smart_fit_filter(src_w, src_h, target_ratio)

    tw, th = _RATIO_MAP[target_ratio]
    # Subject-aware crop for all orientation combinations.
    # This preserves the detected person near center instead of blurred letterbox fill.
    if src_w / src_h > tw / th:
        crop_h = src_h
        crop_w = _round_even(src_h * tw / th)
    else:
        crop_w = src_w
        crop_h = _round_even(src_w * th / tw)

    crop_w = max(2, min(crop_w, src_w))
    crop_h = max(2, min(crop_h, src_h))
    x_off = int(subject_x_pct * src_w - crop_w / 2)
    x_off = max(0, min(src_w - crop_w, x_off))
    y_off = (src_h - crop_h) // 2
    vf = f"crop={crop_w}:{crop_h}:{x_off}:{y_off},setsar=1,format=yuv420p"
    return "subject_crop", vf, crop_w, crop_h


def _build_smart_fit_filter(
    src_w: int,
    src_h: int,
    target_ratio: str,
) -> tuple[Literal["smart_fit"], str, int, int]:
    if target_ratio == "9:16":
        out_w = 720
        out_h = 1280
    else:
        out_w = 1280
        out_h = 720

    fc = (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
        f"crop={out_w}:{out_h},boxblur=18:3[bgf];"
        f"[fg]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease[fgf];"
        f"[bgf][fgf]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]"
    )
    return "smart_fit", fc, out_w, out_h


def _should_use_smart_fit(
    src_w: int,
    src_h: int,
    target_ratio: str,
    profile: dict[str, float | int] | None,
) -> bool:
    if target_ratio != "9:16":
        return False
    if src_w <= src_h:
        return False
    if not profile:
        return False

    spread = float(profile.get("spread", 0.0) or 0.0)
    edge_hits = int(profile.get("edge_hits", 0) or 0)
    count = int(profile.get("count", 0) or 0)

    # Portrait crop width vs source width (e.g. 16:9 -> 9:16 keeps only ~31.6% width).
    portrait_crop_width = (src_h * 9.0) / 16.0
    kept_width_ratio = portrait_crop_width / max(1.0, float(src_w))

    unstable_subject = spread >= 0.22 or edge_hits >= 1 or count < 2
    narrow_crop = kept_width_ratio <= 0.38
    return narrow_crop and unstable_subject


async def _run_ffmpeg_reframe(
    input_path: str,
    output_path: str,
    filter_str: str,
    use_filter_complex: bool = False,
) -> None:
    cmd = ["ffmpeg", "-y", "-i", input_path]
    if use_filter_complex:
        cmd += ["-filter_complex", filter_str, "-map", "[v]", "-map", "0:a:0?"]
    else:
        cmd += ["-vf", filter_str, "-map", "0:v:0", "-map", "0:a:0?"]
    cmd += [
        "-sn",
        "-dn",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-threads",
        "1",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        output_path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg reframe failed rc={proc.returncode}: "
            f"{stderr.decode(errors='replace')[-800:]}"
        )
