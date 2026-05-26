"""MediaPipe/OpenCV auto-center rendering for shorts reframing."""
from __future__ import annotations

import asyncio
import logging
import math
import os
import subprocess
import tempfile
from typing import Any, Literal

logger = logging.getLogger(__name__)

_TARGET_OUTPUTS: dict[str, tuple[int, int]] = {
    "16:9": (1280, 720),
    "9:16": (720, 1280),
}


class AutoCenterUnavailable(RuntimeError):
    """Raised when the runtime cannot run the auto-center pipeline."""


class AutoCenterFallbackRequired(RuntimeError):
    """Raised when full-fit rendering is safer than a face-centered crop."""

    def __init__(self, reason: str, profile: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.profile = profile or {}


async def auto_center_video(
    input_path: str,
    output_path: str,
    target_ratio: Literal["16:9", "9:16"],
) -> dict[str, Any]:
    """Render a dynamically cropped video using MediaPipe face detection."""

    return await asyncio.to_thread(_auto_center_video_sync, input_path, output_path, target_ratio)


def _auto_center_video_sync(
    input_path: str,
    output_path: str,
    target_ratio: Literal["16:9", "9:16"],
) -> dict[str, Any]:
    if target_ratio not in _TARGET_OUTPUTS:
        raise ValueError(f"Unsupported target ratio: {target_ratio!r}")

    cv2, mp = _load_video_dependencies()
    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video for reframe: {input_path!r}")

    try:
        src_w = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        src_h = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    finally:
        capture.release()

    if src_w <= 0 or src_h <= 0:
        raise RuntimeError(f"Could not read video dimensions: {input_path!r}")
    if fps <= 1.0 or not math.isfinite(fps):
        fps = 30.0

    target_w, target_h = _TARGET_OUTPUTS[target_ratio]
    crop_w, crop_h = _compute_crop_size(src_w, src_h, target_w, target_h)
    sample_stride = max(1, int(round(fps / 8.0)))

    detections, sampled_frames, detector_name = _detect_face_centers(
        cv2=cv2,
        mp=mp,
        input_path=input_path,
        src_w=src_w,
        src_h=src_h,
        sample_stride=sample_stride,
    )
    profile = _build_detection_profile(
        detections=detections,
        sampled_frames=sampled_frames,
        src_w=src_w,
        src_h=src_h,
        crop_w=crop_w,
        crop_h=crop_h,
        frame_count=frame_count,
    )

    fallback_reason = _fit_fallback_reason(target_ratio, src_w, src_h, profile)
    if fallback_reason:
        raise AutoCenterFallbackRequired(fallback_reason, profile)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    temp_path = _render_centered_video(
        cv2=cv2,
        input_path=input_path,
        detections=detections,
        output_w=target_w,
        output_h=target_h,
        crop_w=crop_w,
        crop_h=crop_h,
        fps=fps,
    )
    try:
        _mux_rendered_video(input_path, temp_path, output_path)
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    return {
        "output_path": output_path,
        "width": target_w,
        "height": target_h,
        "method": "mediapipe_auto_center" if detector_name == "mediapipe" else "opencv_auto_center",
        "fit_mode": "person_crop",
        "subject_x_pct": float(profile.get("subject_x_pct", 0.5)),
        "subject_spread": float(profile.get("spread", 0.0)),
        "edge_hits": int(profile.get("edge_hits", 0)),
        "detection_rate": float(profile.get("detection_rate", 0.0)),
        "detector": detector_name,
        "sample_stride": sample_stride,
        "crop_width": crop_w,
        "crop_height": crop_h,
    }


def _load_video_dependencies() -> tuple[Any, Any]:
    try:
        import cv2  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - environment dependent
        raise AutoCenterUnavailable(
            "OpenCV is not installed. Install backend requirements to enable smart person tracking."
        ) from exc

    try:
        import mediapipe as mp  # type: ignore[import-not-found]
    except Exception:
        logger.warning("MediaPipe is unavailable; using OpenCV face detection fallback for auto-center.")
        mp = None
    return cv2, mp


def _compute_crop_size(src_w: int, src_h: int, target_w: int, target_h: int) -> tuple[int, int]:
    target_ratio = target_w / target_h
    source_ratio = src_w / src_h
    if source_ratio > target_ratio:
        crop_h = src_h
        crop_w = _even(src_h * target_ratio)
    else:
        crop_w = src_w
        crop_h = _even(src_w / target_ratio)
    return max(2, min(crop_w, src_w)), max(2, min(crop_h, src_h))


def _detect_face_centers(
    *,
    cv2: Any,
    mp: Any,
    input_path: str,
    src_w: int,
    src_h: int,
    sample_stride: int,
) -> tuple[list[dict[str, float | int]], int, str]:
    if mp is None:
        return _detect_face_centers_opencv(
            cv2=cv2,
            input_path=input_path,
            src_w=src_w,
            src_h=src_h,
            sample_stride=sample_stride,
        )

    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video for face detection: {input_path!r}")

    detections: list[dict[str, float | int]] = []
    sampled_frames = 0
    frame_index = 0
    face_detection = mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.45,
    )

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % sample_stride == 0:
                sampled_frames += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = face_detection.process(rgb)
                picked = _pick_best_face(result.detections or [], src_w, src_h)
                if picked:
                    picked["frame"] = frame_index
                    detections.append(picked)
            frame_index += 1
    finally:
        capture.release()
        face_detection.close()

    return detections, sampled_frames, "mediapipe"


def _detect_face_centers_opencv(
    *,
    cv2: Any,
    input_path: str,
    src_w: int,
    src_h: int,
    sample_stride: int,
) -> tuple[list[dict[str, float | int]], int, str]:
    cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    cascade = cv2.CascadeClassifier(cascade_path)
    if cascade.empty():
        raise AutoCenterUnavailable("OpenCV face detector cascade is unavailable.")

    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video for OpenCV face detection: {input_path!r}")

    detections: list[dict[str, float | int]] = []
    sampled_frames = 0
    frame_index = 0
    min_face = max(28, min(src_w, src_h) // 18)

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % sample_stride == 0:
                sampled_frames += 1
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                gray = cv2.equalizeHist(gray)
                faces = cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.08,
                    minNeighbors=4,
                    minSize=(min_face, min_face),
                )
                picked = _pick_best_opencv_face(faces, src_w, src_h)
                if picked:
                    picked["frame"] = frame_index
                    detections.append(picked)
            frame_index += 1
    finally:
        capture.release()

    return detections, sampled_frames, "opencv_haar"


def _pick_best_opencv_face(faces: Any, src_w: int, src_h: int) -> dict[str, float] | None:
    best: dict[str, float] | None = None
    best_score = -1.0
    for x, y, w, h in faces:
        cx = float(x + w / 2.0)
        cy = float(y + h / 2.0)
        area = float(w * h) / max(1.0, float(src_w * src_h))
        center_bias = 1.0 - min(1.0, abs(cx - src_w / 2.0) / max(1.0, src_w / 2.0))
        score = area * 4.0 + center_bias * 0.25
        if score > best_score:
            best_score = score
            best = {
                "x": cx,
                "y": cy,
                "w": float(w),
                "h": float(h),
                "confidence": 0.65,
            }
    return best


def _pick_best_face(detections: list[Any], src_w: int, src_h: int) -> dict[str, float] | None:
    best: dict[str, float] | None = None
    best_score = -1.0
    for detection in detections:
        bbox = detection.location_data.relative_bounding_box
        x = _clamp(float(bbox.xmin), 0.0, 1.0)
        y = _clamp(float(bbox.ymin), 0.0, 1.0)
        w = _clamp(float(bbox.width), 0.0, 1.0)
        h = _clamp(float(bbox.height), 0.0, 1.0)
        cx = (x + w / 2.0) * src_w
        cy = (y + h / 2.0) * src_h
        area = w * h
        confidence = float(detection.score[0] if detection.score else 0.0)
        center_bias = 1.0 - min(1.0, abs(cx - src_w / 2.0) / max(1.0, src_w / 2.0))
        score = confidence * 2.0 + area * 4.0 + center_bias * 0.25
        if score > best_score:
            best_score = score
            best = {
                "x": cx,
                "y": cy,
                "w": w * src_w,
                "h": h * src_h,
                "confidence": confidence,
            }
    return best


def _build_detection_profile(
    *,
    detections: list[dict[str, float | int]],
    sampled_frames: int,
    src_w: int,
    src_h: int,
    crop_w: int,
    crop_h: int,
    frame_count: int,
) -> dict[str, float | int]:
    if not detections or sampled_frames <= 0:
        return {
            "subject_x_pct": 0.5,
            "spread": 0.0,
            "edge_hits": 0,
            "count": 0,
            "sampled_frames": sampled_frames,
            "detection_rate": 0.0,
            "frame_count": frame_count,
            "max_face_to_crop": 0.0,
        }

    xs = [float(item["x"]) / max(1.0, float(src_w)) for item in detections]
    ys = [float(item["y"]) / max(1.0, float(src_h)) for item in detections]
    face_to_crop = [
        max(float(item["w"]) / max(1.0, float(crop_w)), float(item["h"]) / max(1.0, float(crop_h)))
        for item in detections
    ]
    ordered_x = sorted(xs)
    ordered_y = sorted(ys)
    median_x = ordered_x[len(ordered_x) // 2]
    median_y = ordered_y[len(ordered_y) // 2]
    return {
        "subject_x_pct": median_x,
        "subject_y_pct": median_y,
        "spread": max(xs) - min(xs),
        "vertical_spread": max(ys) - min(ys),
        "edge_hits": sum(1 for value in xs if value <= 0.13 or value >= 0.87),
        "count": len(detections),
        "sampled_frames": sampled_frames,
        "detection_rate": len(detections) / max(1, sampled_frames),
        "frame_count": frame_count,
        "max_face_to_crop": max(face_to_crop),
    }


def _fit_fallback_reason(
    target_ratio: str,
    src_w: int,
    src_h: int,
    profile: dict[str, float | int],
) -> str | None:
    if target_ratio != "9:16" or src_w <= src_h:
        return None

    count = int(profile.get("count", 0) or 0)
    detection_rate = float(profile.get("detection_rate", 0.0) or 0.0)
    max_face_to_crop = float(profile.get("max_face_to_crop", 0.0) or 0.0)

    if count < 2 or detection_rate < 0.18:
        return "face_detection_low_confidence"
    if max_face_to_crop >= 0.72:
        return "subject_too_close_for_portrait_crop"
    return None


def _render_centered_video(
    *,
    cv2: Any,
    input_path: str,
    detections: list[dict[str, float | int]],
    output_w: int,
    output_h: int,
    crop_w: int,
    crop_h: int,
    fps: float,
) -> str:
    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video for centered render: {input_path!r}")

    src_w = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    src_h = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    temp_path = temp.name
    temp.close()

    writer = cv2.VideoWriter(
        temp_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (output_w, output_h),
    )
    if not writer.isOpened():
        capture.release()
        raise RuntimeError("Could not create temporary auto-center video writer")

    frame_index = 0
    cursor = 0
    smooth_x = float(detections[0]["x"])
    smooth_y = float(detections[0]["y"])
    dead_x = max(20.0, crop_w * 0.045)
    dead_y = max(20.0, crop_h * 0.04)

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break

            target_x, target_y, cursor = _interpolated_center(detections, frame_index, cursor)
            move_x = target_x - smooth_x
            move_y = target_y - smooth_y
            if abs(move_x) < dead_x:
                target_x = smooth_x
            if abs(move_y) < dead_y:
                target_y = smooth_y

            velocity = math.hypot(target_x - smooth_x, target_y - smooth_y) / max(1.0, float(max(src_w, src_h)))
            alpha = _clamp(0.12 + velocity * 2.4, 0.10, 0.42)
            smooth_x = alpha * target_x + (1.0 - alpha) * smooth_x
            smooth_y = alpha * target_y + (1.0 - alpha) * smooth_y

            x0 = int(round(smooth_x - crop_w / 2.0))
            y0 = int(round(smooth_y - crop_h / 2.0))
            x0 = int(_clamp(float(x0), 0.0, float(max(0, src_w - crop_w))))
            y0 = int(_clamp(float(y0), 0.0, float(max(0, src_h - crop_h))))

            crop = frame[y0 : y0 + crop_h, x0 : x0 + crop_w]
            if crop.size == 0:
                raise RuntimeError("Auto-center crop produced an empty frame")
            resized = cv2.resize(crop, (output_w, output_h), interpolation=cv2.INTER_LINEAR)
            writer.write(resized)
            frame_index += 1
    finally:
        capture.release()
        writer.release()

    return temp_path


def _interpolated_center(
    detections: list[dict[str, float | int]],
    frame_index: int,
    cursor: int,
) -> tuple[float, float, int]:
    if frame_index <= int(detections[0]["frame"]):
        return float(detections[0]["x"]), float(detections[0]["y"]), 0

    while cursor + 1 < len(detections) and int(detections[cursor + 1]["frame"]) <= frame_index:
        cursor += 1

    current = detections[cursor]
    if cursor + 1 >= len(detections):
        return float(current["x"]), float(current["y"]), cursor

    following = detections[cursor + 1]
    start = int(current["frame"])
    end = int(following["frame"])
    span = max(1, end - start)
    t = _clamp((frame_index - start) / span, 0.0, 1.0)
    x = float(current["x"]) + (float(following["x"]) - float(current["x"])) * t
    y = float(current["y"]) + (float(following["y"]) - float(current["y"])) * t
    return x, y, cursor


def _mux_rendered_video(input_path: str, rendered_path: str, output_path: str) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        rendered_path,
        "-i",
        input_path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        output_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg auto-center mux failed rc={proc.returncode}: "
            f"{proc.stderr.decode(errors='replace')[-800:]}"
        )


def _even(value: float) -> int:
    number = int(round(value))
    if number % 2:
        number -= 1
    return max(2, number)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))
