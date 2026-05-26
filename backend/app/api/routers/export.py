"""Export router — burn captions into video as MP4 720p via FFmpeg."""
import asyncio
import logging
import os
import re
import subprocess
import time
import urllib.request
from urllib.parse import urlparse
from typing import Any, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db.database import get_database
from app.core.security import get_current_active_user
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/export", tags=["Export"])

EXPORT_TTL_SECONDS = 24 * 60 * 60   # ARCH-05: delete exports older than 24h
# ARCH-07 (SEC-07): Only allow B-roll from trusted Pexels CDN domains
ALLOWED_BROLL_DOMAINS = {"videos.pexels.com", "player.vimeo.com"}
ALLOWED_IMAGE_DOMAINS = {"images.pexels.com", "images.unsplash.com"}
ALLOWED_AUDIO_DOMAINS = {"res.cloudinary.com"}
CAPTION_REFERENCE_WIDTH = 600.0
CAPTION_REFERENCE_HEIGHT = 338.0
CAPTION_MIN_SCALE = 0.58
CAPTION_MAX_SCALE = 1.35
DEFAULT_MUSIC_VOLUME_DB = -15.0
DEFAULT_SFX_VOLUME_DB = -7.0


# ─── Request Schema ──────────────────────────────────────────────────────────

class CueInput(BaseModel):
    text: str
    start_ms: int
    end_ms: int
    broll: Optional[dict] = None
    highlight_words: Optional[List[str]] = None
    emoji: Optional[str] = None
    emoji_start_ms: Optional[int] = None
    emoji_end_ms: Optional[int] = None


class BrollTrackInput(BaseModel):
    video_url: str
    pexels_id: Optional[str] = None
    start_ms: int
    end_ms: int


class MotionGraphicsTrackInput(BaseModel):
    clip_id: str
    cue_id: Optional[str] = None
    text: str
    keyword: Optional[str] = None
    source_text: Optional[str] = None
    start_ms: int
    end_ms: int
    style: str = "clean_callout"
    style_family: str = "cinematic_creator"
    moment_type: str = "explanation"
    motion_role: str = "secondary"
    motion_principle: str = "ease_out_overshoot"
    important_words: Optional[List[str]] = None
    placement: str = "lower_third"
    accent_color: str = "#2563EB"
    background: str = "rgba(239,246,255,0.92)"
    solid_background: str = "#F8FAFC"
    image_url: Optional[str] = None
    image_alt: Optional[str] = None
    image_pexels_id: Optional[str] = None
    image_credit: Optional[str] = None
    image_query: Optional[str] = None
    animation: str = "slide-rise"
    sound_cue: str = "soft_whoosh"
    editing_note: Optional[str] = None


class MusicTrackInput(BaseModel):
    preview_url: str
    start_ms: int = 0
    end_ms: Optional[int] = None
    duration: Optional[float] = None
    volume_db: float = DEFAULT_MUSIC_VOLUME_DB
    trim_start_ms: int = 0
    trim_end_ms: Optional[int] = None


class SfxTrackInput(BaseModel):
    file_url: str
    start_ms: int
    end_ms: Optional[int] = None
    duration: Optional[float] = None
    volume_db: float = DEFAULT_SFX_VOLUME_DB
    trim_start_ms: int = 0
    trim_end_ms: Optional[int] = None


class CaptionStyle(BaseModel):
    fontFamily: str = "Komika Axis"
    fontSize: int = 34
    fontWeight: int = 900
    italic: bool = False
    underline: bool = False
    uppercase: bool = False
    textCase: str = "original"
    color: str = "#FFFFFF"
    highlightColor: str = "#FFD400"
    highlightTextColor: str = "#FFD400"
    strokeColor: str = "#000000"
    strokeWidth: float = 3
    shadowColor: str = "rgba(0,0,0,0.88)"
    background: str = "transparent"
    letterSpacing: float = 0
    textOpacity: float = 1.0
    position: str = "bottom"  # top | center | bottom
    align: str = "center"
    offsetX: float = 0
    offsetY: float = 0
    maxWidthPct: float = 88
    captionMode: str = "chunk"


class PreviewViewport(BaseModel):
    width: float
    height: float


class ExportRequest(BaseModel):
    cues: List[CueInput]
    broll_track: Optional[List[BrollTrackInput]] = None
    motion_graphics_track: Optional[List[MotionGraphicsTrackInput]] = None
    music_track: Optional[MusicTrackInput] = None
    sfx_track: Optional[List[SfxTrackInput]] = None
    style: Optional[CaptionStyle] = None
    target_aspect_ratio: Optional[str] = "original"
    preview_viewport: Optional[PreviewViewport] = None


async def _resolve_export_style(
    db: Any,
    project_id: str,
    user_id: str,
    request_style: Optional[CaptionStyle],
) -> CaptionStyle:
    request_patch: dict[str, Any] = {}
    if request_style is not None:
        try:
            request_patch = request_style.model_dump(exclude_unset=True)
        except Exception:
            request_patch = {}

    persisted_patch: dict[str, Any] = {}
    try:
        settings_doc = await db.project_settings.find_one({"project_id": project_id, "user_id": user_id})
        candidate = (settings_doc or {}).get("resolved_style", {})
        if isinstance(candidate, dict):
            persisted_patch = candidate
    except Exception as exc:
        logger.warning("Could not read persisted control-panel style for project %s: %s", project_id, exc)

    if not request_patch and not persisted_patch:
        return request_style or CaptionStyle()

    merged: dict[str, Any] = {}
    merged.update(persisted_patch)
    merged.update(request_patch)
    try:
        return CaptionStyle(**merged)
    except Exception as exc:
        logger.warning("Failed to merge export style for project %s: %s", project_id, exc)
        return request_style or CaptionStyle()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_css_color(color: str, fallback: tuple[int, int, int, float]) -> tuple[int, int, int, float]:
    raw = (color or "").strip()
    if not raw:
        return fallback
    if raw.lower() in {"transparent", "none"}:
        return (0, 0, 0, 0.0)

    hex3 = re.fullmatch(r"#([0-9A-Fa-f]{3})", raw)
    if hex3:
        v = hex3.group(1)
        return (
            int(v[0] + v[0], 16),
            int(v[1] + v[1], 16),
            int(v[2] + v[2], 16),
            1.0,
        )

    hex4 = re.fullmatch(r"#([0-9A-Fa-f]{4})", raw)
    if hex4:
        v = hex4.group(1)
        return (
            int(v[0] + v[0], 16),
            int(v[1] + v[1], 16),
            int(v[2] + v[2], 16),
            int(v[3] + v[3], 16) / 255.0,
        )

    hex6 = re.fullmatch(r"#([0-9A-Fa-f]{6})", raw)
    if hex6:
        v = hex6.group(1)
        return (
            int(v[0:2], 16),
            int(v[2:4], 16),
            int(v[4:6], 16),
            1.0,
        )

    hex8 = re.fullmatch(r"#([0-9A-Fa-f]{8})", raw)
    if hex8:
        v = hex8.group(1)
        return (
            int(v[0:2], 16),
            int(v[2:4], 16),
            int(v[4:6], 16),
            int(v[6:8], 16) / 255.0,
        )

    rgb = re.fullmatch(
        r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)",
        raw,
        re.IGNORECASE,
    )
    if rgb:
        r = int(_clamp(int(rgb.group(1)), 0, 255, 0))
        g = int(_clamp(int(rgb.group(2)), 0, 255, 0))
        b = int(_clamp(int(rgb.group(3)), 0, 255, 0))
        a = float(_clamp(float(rgb.group(4)) if rgb.group(4) else 1.0, 0.0, 1.0, 1.0))
        return (r, g, b, a)

    return fallback


def _rgba_to_ass_color(r: int, g: int, b: int, opacity: float) -> str:
    clamped_opacity = _clamp(opacity, 0.0, 1.0, 1.0)
    transparency = int(round((1.0 - clamped_opacity) * 255.0))
    return f"&H{transparency:02X}{int(b):02X}{int(g):02X}{int(r):02X}&"


def css_to_ass_color(
    color: str,
    fallback: tuple[int, int, int, float] = (255, 255, 255, 1.0),
    opacity_multiplier: float = 1.0,
) -> str:
    r, g, b, a = _parse_css_color(color, fallback)
    return _rgba_to_ass_color(r, g, b, _clamp(a * opacity_multiplier, 0.0, 1.0, 1.0))


def ms_to_ass_time(ms: int) -> str:
    """Convert milliseconds to ASS timestamp H:MM:SS.cc"""
    total_s = ms / 1000
    h = int(total_s // 3600)
    m = int((total_s % 3600) // 60)
    s = total_s % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _sanitize_ass_font_name(font_family: str) -> str:
    # ASS expects a single font face name (not a CSS fallback stack).
    raw = (font_family or "").split(",")[0].strip().strip("'\"")
    if not raw or raw.lower() == "hobo":
        return "Arial"
    return raw


def _find_export_fonts_dir() -> Optional[str]:
    """Return a usable FFmpeg fonts directory if the licensed font was bundled."""
    candidates = [
        os.path.join("fonts"),
        os.path.join("backend", "fonts"),
        os.path.join("uploads", "fonts"),
        os.path.join("..", "frontend", "public", "fonts"),
    ]
    font_exts = {".ttf", ".otf", ".woff", ".woff2"}
    for candidate in candidates:
        if not os.path.isdir(candidate):
            continue
        try:
            has_font = any(
                os.path.splitext(name)[1].lower() in font_exts
                for name in os.listdir(candidate)
            )
        except OSError:
            continue
        if has_font:
            return candidate.replace("\\", "/")
    return None


def _ass_filter(ass_path_forward: str) -> str:
    fonts_dir = _find_export_fonts_dir()
    if not fonts_dir:
        return f"ass='{ass_path_forward}'"
    return f"ass='{ass_path_forward}':fontsdir='{fonts_dir}'"


def _clamp(value: float, low: float, high: float, fallback: float) -> float:
    try:
        numeric = float(value)
    except Exception:
        return fallback
    return max(low, min(high, numeric))


def _caption_scale_for_aspect(video_width: int, video_height: int) -> float:
    """Fallback scale when preview viewport size is unavailable."""
    width = _clamp(video_width, 1, 10000, 1280)
    height = _clamp(video_height, 1, 10000, 720)
    width_ratio = width / 1280
    aspect_ratio = width / max(1, height)
    aspect_bias = 1.06 if aspect_ratio < 1 else 1
    return _clamp(width_ratio * aspect_bias, 0.55, 1.25, 1)


def _preview_responsive_scale(preview_width: float, preview_height: float) -> float:
    width_scale = _clamp(preview_width, 1, 5000, CAPTION_REFERENCE_WIDTH) / CAPTION_REFERENCE_WIDTH
    height_scale = _clamp(preview_height, 1, 5000, CAPTION_REFERENCE_HEIGHT) / CAPTION_REFERENCE_HEIGHT
    area_scale = (width_scale * height_scale) ** 0.5
    aspect_ratio = preview_width / max(1.0, preview_height)
    aspect_bias = 0.94 if aspect_ratio < 1 else 1.0
    return _clamp(area_scale * aspect_bias, CAPTION_MIN_SCALE, CAPTION_MAX_SCALE, 1.0)


def _caption_scale_for_export(
    video_width: int,
    video_height: int,
    preview_viewport: Optional[PreviewViewport],
) -> float:
    if preview_viewport and preview_viewport.width > 0 and preview_viewport.height > 0:
        preview_width = _clamp(preview_viewport.width, 1, 5000, CAPTION_REFERENCE_WIDTH)
        preview_height = _clamp(preview_viewport.height, 1, 5000, CAPTION_REFERENCE_HEIGHT)
        responsive_scale = _preview_responsive_scale(preview_width, preview_height)
        pixel_scale = _clamp(video_width / max(1.0, preview_width), 0.1, 10.0, 1.0)
        return _clamp(pixel_scale * responsive_scale, 0.4, 4.0, 1.0)
    return _caption_scale_for_aspect(video_width, video_height)


def _escape_ass_text(text: str) -> str:
    return (
        (text or "")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\n", r"\N")
    )


def _normalize_highlight_word(value: str) -> str:
    match = re.search(r"[A-Za-z0-9']+", value or "")
    return match.group(0).lower() if match else ""


def _format_ass_text_with_highlights(
    text: str,
    highlight_words: Optional[List[str]],
    primary_color: str,
    highlight_color: str,
) -> str:
    normalized_words = {
        normalized
        for word in (highlight_words or [])
        if (normalized := _normalize_highlight_word(str(word)))
    }
    if not normalized_words:
        return _escape_ass_text(text)

    plain = (text or "").replace(r"\N", "\n")
    output: list[str] = []
    cursor = 0
    for match in re.finditer(r"[A-Za-z0-9']+", plain):
        output.append(_escape_ass_text(plain[cursor:match.start()]))
        token = match.group(0)
        escaped_token = _escape_ass_text(token)
        if _normalize_highlight_word(token) in normalized_words:
            output.append(f"{{\\c{highlight_color}}}{escaped_token}{{\\c{primary_color}}}")
        else:
            output.append(escaped_token)
        cursor = match.end()
    output.append(_escape_ass_text(plain[cursor:]))
    return "".join(output)


def _append_ass_emoji_line(
    ass_text: str,
    emoji: Optional[str],
    *,
    font_size: int,
    primary_color: str,
    style_scale: float,
) -> str:
    emoji_text = _escape_ass_text(str(emoji or "").strip())
    if not emoji_text:
        return ass_text

    emoji_size = int(round(_clamp(font_size * 0.72, 12, 72, 24)))
    emoji_shadow = round(_clamp(1.0 * style_scale, 0.0, 4.0, 1.0), 2)
    return (
        f"{ass_text}"
        f"\\N{{\\fnSegoe UI Emoji\\fs{emoji_size}\\bord0\\shad{emoji_shadow}\\c{primary_color}}}"
        f"{emoji_text}"
    )


def _format_ass_emoji_text(
    emoji: Optional[str],
    *,
    font_size: int,
    primary_color: str,
    style_scale: float,
) -> str:
    emoji_text = _escape_ass_text(str(emoji or "").strip())
    if not emoji_text:
        return ""
    emoji_size = int(round(_clamp(font_size * 0.72, 12, 72, 24)))
    emoji_shadow = round(_clamp(1.0 * style_scale, 0.0, 4.0, 1.0), 2)
    return f"{{\\fnSegoe UI Emoji\\fs{emoji_size}\\bord0\\shad{emoji_shadow}\\c{primary_color}}}{emoji_text}"


def _build_emoji_position_override(
    style: CaptionStyle,
    video_width: int,
    video_height: int,
    style_scale: float,
    font_size: int,
) -> str:
    safe_x = int(round(video_width * 0.06))
    safe_y = int(round(video_height * 0.08))
    offset_x = _clamp(style.offsetX * style_scale, -video_width, video_width, 0)
    offset_y = _clamp(style.offsetY * style_scale, -video_height, video_height, 0)
    align = str(style.align or "center").strip().lower()
    position = str(style.position or "bottom").strip().lower()

    if align == "left":
        base_x = safe_x
        ass_alignment = 7
    elif align == "right":
        base_x = video_width - safe_x
        ass_alignment = 9
    else:
        base_x = video_width / 2
        ass_alignment = 8

    if position == "top":
        base_y = safe_y + font_size * 1.05
    elif position == "center":
        base_y = video_height / 2 + font_size * 0.95
    else:
        base_y = video_height - safe_y + font_size * 0.35

    pos_x = int(round(_clamp(base_x + offset_x, 0, video_width, video_width / 2)))
    pos_y = int(round(_clamp(base_y + offset_y, 0, video_height - max(4, safe_y * 0.25), video_height / 2)))
    return f"{{\\an{ass_alignment}\\pos({pos_x},{pos_y})}}"


def _apply_text_case(value: str, mode: str, uppercase_fallback: bool) -> str:
    text = value or ""
    normalized = (mode or "").strip().lower()
    if normalized == "upper" or uppercase_fallback:
        return text.upper()
    if normalized == "lower":
        return text.lower()
    if normalized == "title":
        parts = text.split(" ")
        return " ".join(part[:1].upper() + part[1:].lower() if part else "" for part in parts)
    return text


def _estimate_max_chars(video_width: int, max_width_pct: float, font_size: float, letter_spacing: float) -> int:
    width_pct = min(88.0, _clamp(max_width_pct, 40.0, 100.0, 88.0))
    max_text_width_px = max(32.0, float(video_width) * (width_pct / 100.0))
    approx_char_px = max(5.0, float(font_size) * 0.56 + max(0.0, float(letter_spacing)))
    return int(max(8, round(max_text_width_px / approx_char_px)))


def _wrap_caption_text(text: str, max_chars: int) -> str:
    words = [w for w in (text or "").split() if w]
    if not words:
        return ""
    if max_chars <= 0:
        return " ".join(words)

    lines: list[str] = []
    line_words: list[str] = []
    line_len = 0
    for word in words:
        extra = len(word) if not line_words else len(word) + 1
        if line_words and line_len + extra > max_chars:
            lines.append(" ".join(line_words))
            line_words = [word]
            line_len = len(word)
        else:
            line_words.append(word)
            line_len += extra
    if line_words:
        lines.append(" ".join(line_words))
    return r"\N".join(lines)


def _build_position_override(style: CaptionStyle, video_width: int, video_height: int, style_scale: float) -> str:
    offset_x = _clamp(style.offsetX * style_scale, -video_width, video_width, 0)
    offset_y = _clamp(style.offsetY * style_scale, -video_height, video_height, 0)
    if abs(offset_x) < 0.5 and abs(offset_y) < 0.5:
        return ""

    safe_x = int(round(video_width * 0.06))
    safe_y = int(round(video_height * 0.08))
    align = str(style.align or "center").strip().lower()
    position = str(style.position or "bottom").strip().lower()

    if align == "left":
        base_x = safe_x
    elif align == "right":
        base_x = video_width - safe_x
    else:
        base_x = video_width / 2

    if position == "top":
        base_y = safe_y
    elif position == "center":
        base_y = video_height / 2
    else:
        base_y = video_height - safe_y

    pos_x = int(round(_clamp(base_x + offset_x, 0, video_width, video_width / 2)))
    pos_y = int(round(_clamp(base_y + offset_y, 0, video_height, video_height / 2)))
    return f"{{\\pos({pos_x},{pos_y})}}"


def _word_mode_segments(cue: CueInput) -> list[tuple[int, int, str]]:
    words = [w for w in re.findall(r"\S+", cue.text or "") if w]
    if len(words) <= 1:
        return [(cue.start_ms, cue.end_ms, cue.text or "")]

    total_ms = max(1, cue.end_ms - cue.start_ms)
    weights = [max(1, len(w)) for w in words]
    total_weight = sum(weights)
    min_word_ms = 33
    cursor = cue.start_ms
    segments: list[tuple[int, int, str]] = []
    consumed_weight = 0

    for idx, word in enumerate(words):
        consumed_weight += weights[idx]
        remaining_words = len(words) - idx - 1
        if idx == len(words) - 1:
            seg_end = cue.end_ms
        else:
            target_end = cue.start_ms + int(round(total_ms * (consumed_weight / total_weight)))
            latest_end = cue.end_ms - (remaining_words * min_word_ms)
            seg_end = int(max(cursor + min_word_ms, min(target_end, latest_end)))
            seg_end = max(seg_end, cursor + 1)
        segments.append((cursor, seg_end, word))
        cursor = seg_end

    if segments:
        last_start, _, last_word = segments[-1]
        segments[-1] = (last_start, cue.end_ms, last_word)
    return segments


def _ass_override_color_tag(tag: str, color: str, fallback: tuple[int, int, int, float]) -> str:
    return f"\\{tag}{css_to_ass_color(color, fallback)}"


def _motion_position_override(
    placement: str,
    video_width: int,
    video_height: int,
) -> tuple[int, int, int]:
    normalized = (placement or "lower_third").strip().lower()
    if normalized == "center":
        return 5, video_width // 2, int(round(video_height * 0.48))
    if normalized == "top_right":
        return 9, int(round(video_width * 0.94)), int(round(video_height * 0.12))
    if normalized == "top_left":
        return 7, int(round(video_width * 0.06)), int(round(video_height * 0.12))
    if normalized == "bottom_left":
        return 1, int(round(video_width * 0.06)), int(round(video_height * 0.86))
    return 2, video_width // 2, int(round(video_height * 0.78))


def _motion_font_size(video_width: int, video_height: int, text: str) -> int:
    base = min(video_width, video_height)
    words = max(1, len(re.findall(r"\S+", text or "")))
    size = base * (0.086 if words <= 2 else 0.068 if words <= 4 else 0.056)
    return int(round(_clamp(size, 28, 92, 52)))


def _motion_visual_mode(clip: MotionGraphicsTrackInput) -> str:
    style = str(clip.style or "").strip().lower()
    style_family = str(clip.style_family or "").strip().lower()
    moment_type = str(clip.moment_type or "").strip().lower()
    if "editorial_image_text" in style or "image_text" in style:
        return "editorial_image"
    if "stat" in style:
        return "stat"
    if "alert" in style:
        return "alert"
    if "ui" in style or style_family == "ui_motion":
        return "ui"
    if "cta" in style or moment_type == "cta":
        return "cta"
    if moment_type == "emotion":
        return "cinematic"
    return "kinetic"


def _ass_shape_event(
    layer: int,
    start: str,
    end: str,
    color: str,
    path: str,
    *,
    x: int = 0,
    y: int = 0,
    alpha: str = "&H88&",
    fade: tuple[int, int] = (100, 180),
) -> str:
    return (
        f"Dialogue: {layer},{start},{end},Motion,,0,0,0,,"
        "{"
        f"\\an7\\pos({x},{y})\\p1\\bord0\\shad0\\c{color}\\alpha{alpha}\\fad({fade[0]},{fade[1]})"
        "}"
        f"{path}"
    )


def _rect_path(width: int, height: int) -> str:
    return f"m 0 0 l {width} 0 l {width} {height} l 0 {height} l 0 0"


def _motion_accent_ass_events(
    clip: MotionGraphicsTrackInput,
    start: str,
    end: str,
    accent_color: str,
    video_width: int,
    video_height: int,
) -> list[str]:
    mode = _motion_visual_mode(clip)
    events: list[str] = []
    is_vertical = video_height > video_width
    thin = max(5, int(round(min(video_width, video_height) * 0.007)))
    medium = max(12, int(round(min(video_width, video_height) * 0.018)))

    if mode == "editorial_image":
        grid_gap = max(52, int(round(min(video_width, video_height) * 0.095)))
        grid_alpha = "&HE8&"
        poster_events: list[str] = []
        for x in range(grid_gap, video_width, grid_gap):
            poster_events.append(_ass_shape_event(
                1,
                start,
                end,
                accent_color,
                _rect_path(1, video_height),
                x=x,
                alpha=grid_alpha,
                fade=(120, 180),
            ))
        for y in range(grid_gap, video_height, grid_gap):
            poster_events.append(_ass_shape_event(
                1,
                start,
                end,
                accent_color,
                _rect_path(video_width, 1),
                y=y,
                alpha=grid_alpha,
                fade=(120, 180),
            ))
        return poster_events

    # Common premium accent: top rule and soft lower depth plate.
    events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(video_width, thin), alpha="&H55&"))
    events.append(_ass_shape_event(
        1,
        start,
        end,
        accent_color,
        _rect_path(int(video_width * 0.62), medium),
        x=int(video_width * 0.19),
        y=int(video_height * (0.86 if is_vertical else 0.82)),
        alpha="&HBB&",
    ))

    if mode == "ui":
        bracket_w = int(video_width * (0.22 if is_vertical else 0.16))
        bracket_h = int(video_height * 0.014)
        events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(bracket_w, bracket_h), x=int(video_width * 0.72), y=int(video_height * 0.12), alpha="&H66&"))
        events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(bracket_h, int(video_height * 0.12)), x=int(video_width * 0.72 + bracket_w), y=int(video_height * 0.12), alpha="&H66&"))
        for idx, width_scale in enumerate((0.16, 0.22, 0.28)):
            events.append(_ass_shape_event(
                1,
                start,
                end,
                accent_color,
                _rect_path(int(video_width * width_scale), max(4, thin // 2)),
                x=int(video_width * 0.08),
                y=int(video_height * (0.17 + idx * 0.032)),
                alpha="&H88&",
            ))
    elif mode == "stat":
        base_x = int(video_width * 0.08)
        base_y = int(video_height * (0.78 if is_vertical else 0.72))
        for idx, scale in enumerate((0.24, 0.48, 0.34, 0.7, 0.55)):
            bar_h = int(video_height * 0.12 * scale)
            events.append(_ass_shape_event(
                1,
                start,
                end,
                accent_color,
                _rect_path(max(7, thin), bar_h),
                x=base_x + idx * max(14, thin * 2),
                y=base_y - bar_h,
                alpha="&H77&",
            ))
    elif mode == "alert":
        slash_h = int(video_height * (0.045 if is_vertical else 0.055))
        slash_y = int(video_height * (0.22 if is_vertical else 0.28))
        events.append(_ass_shape_event(
            1,
            start,
            end,
            accent_color,
            f"m 0 0 l {video_width} {int(slash_h * 0.8)} l {video_width} {slash_h} l 0 {int(slash_h * 0.2)} l 0 0",
            y=slash_y,
            alpha="&H99&",
        ))
        events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(video_width, thin), y=int(video_height * 0.94), alpha="&H66&"))
    elif mode == "cta":
        dock_h = int(video_height * (0.055 if is_vertical else 0.07))
        dock_w = int(video_width * 0.78)
        events.append(_ass_shape_event(
            1,
            start,
            end,
            accent_color,
            _rect_path(dock_w, dock_h),
            x=int((video_width - dock_w) / 2),
            y=int(video_height * (0.88 if is_vertical else 0.84)),
            alpha="&HAA&",
        ))
    elif mode == "cinematic":
        band_h = int(video_height * (0.045 if is_vertical else 0.075))
        events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(video_width, band_h), y=0, alpha="&HDD&"))
        events.append(_ass_shape_event(1, start, end, accent_color, _rect_path(video_width, band_h), y=video_height - band_h, alpha="&HDD&"))
    else:
        plate_w = int(video_width * (0.48 if is_vertical else 0.34))
        plate_h = max(8, medium)
        events.append(_ass_shape_event(
            1,
            start,
            end,
            accent_color,
            _rect_path(plate_w, plate_h),
            x=int((video_width - plate_w) / 2),
            y=int(video_height * (0.28 if is_vertical else 0.26)),
            alpha="&H88&",
        ))
        events.append(_ass_shape_event(
            1,
            start,
            end,
            accent_color,
            _rect_path(int(plate_w * 0.72), max(5, thin)),
            x=int((video_width - plate_w * 0.72) / 2),
            y=int(video_height * (0.66 if is_vertical else 0.68)),
            alpha="&H99&",
        ))

    return events


def _format_ass_text_with_word_opacity(
    text: str,
    duration_ms: int,
    *,
    highlight_words: Optional[List[str]] = None,
    primary_color: str,
    accent_color: str,
    font_name: str,
) -> str:
    plain = (text or "").replace(r"\N", "\n")
    matches = list(re.finditer(r"[A-Za-z0-9']+", plain))
    if not matches:
        return _escape_ass_text(text)
    normalized_words = {
        normalized
        for word in (highlight_words or [])
        if (normalized := _normalize_highlight_word(str(word)))
    }

    step_ms = int(_clamp(duration_ms / max(1, len(matches) + 2), 90, 180, 130))
    reveal_ms = int(_clamp(duration_ms * 0.18, 140, 300, 220))
    hold_until_ms = max(0, duration_ms - 240)
    poster_sans_font = "Plus Jakarta Sans"
    poster_serif_font = "Source Serif 4"

    output: list[str] = []
    cursor = 0
    for index, match in enumerate(matches):
        output.append(_escape_ass_text(plain[cursor:match.start()]))
        delay_ms = min(hold_until_ms, index * step_ms)
        end_reveal_ms = min(duration_ms, delay_ms + reveal_ms)
        token = _escape_ass_text(match.group(0))
        is_accented = _normalize_highlight_word(match.group(0)) in normalized_words or index == 0
        preface = f"\\c{accent_color}\\i1\\fn{poster_serif_font}" if is_accented else f"\\c{primary_color}\\i0\\fn{poster_sans_font}"
        output.append(
            f"{{{preface}\\alpha&HFF&\\t({delay_ms},{end_reveal_ms},\\alpha&H00&)}}"
            f"{token}"
            f"{{\\c{primary_color}\\i0\\fn{poster_sans_font}\\alpha&H00&}}"
        )
        cursor = match.end()
    output.append(_escape_ass_text(plain[cursor:]))
    return "".join(output)


def _motion_graphics_ass_events(
    clips: Optional[List[MotionGraphicsTrackInput]],
    video_width: int,
    video_height: int,
    font_name: str,
) -> str:
    if not clips:
        return ""

    events: list[str] = []
    for clip in clips:
        start_ms = max(0, int(clip.start_ms))
        end_ms = max(start_ms + 1, min(int(clip.end_ms), start_ms + 3000))
        if end_ms <= start_ms:
            continue

        text = str(clip.text or clip.keyword or "").strip()
        if not text:
            continue
        text = text[:72]
        wrapped = _wrap_caption_text(text, 18 if video_width < video_height else 24)

        alignment, pos_x, pos_y = _motion_position_override(clip.placement, video_width, video_height)
        font_size = _motion_font_size(video_width, video_height, text)
        visual_mode = _motion_visual_mode(clip)
        is_editorial_image = visual_mode == "editorial_image"
        if is_editorial_image:
            alignment = 5
            pos_x = video_width // 2
            pos_y = int(round(video_height * (0.30 if video_height > video_width else 0.32)))
            font_size = int(round(_clamp(font_size * 0.92, 28, 84, font_size)))
        bg_r, bg_g, bg_b, _bg_a = _parse_css_color(
            clip.solid_background or clip.background,
            (248, 250, 252, 1.0),
        )
        solid_bg_color = _rgba_to_ass_color(bg_r, bg_g, bg_b, 1.0)
        accent_color = css_to_ass_color(clip.accent_color, (37, 99, 235, 1.0))
        primary_css = "#050505" if is_editorial_image else "#0F172A"
        primary_color = css_to_ass_color(primary_css, (15, 23, 42, 1.0))
        primary_tag = _ass_override_color_tag("c", primary_css, (15, 23, 42, 1.0))
        outline_tag = _ass_override_color_tag("3c", "#FFFFFF", (255, 255, 255, 1.0))
        back_tag = _ass_override_color_tag("4c", "transparent" if is_editorial_image else clip.background, (239, 246, 255, 0.92))
        motion_role = str(clip.motion_role or "secondary").strip().lower()
        moment_type = str(clip.moment_type or "explanation").strip().lower()
        if is_editorial_image:
            transform_tags = (
                "\\fscx99\\fscy99\\fad(120,180)"
                "\\t(0,360,\\fscx101\\fscy101)"
                "\\t(360,760,\\fscx100\\fscy100)"
            )
            border_width = 0
        elif moment_type == "emotion" or motion_role == "ambient":
            transform_tags = (
                "\\fscx98\\fscy98\\fad(180,260)"
                "\\t(0,420,\\fscx104\\fscy104)"
                "\\t(420,900,\\fscx100\\fscy100)"
            )
            border_width = 2
        elif moment_type == "transition":
            transform_tags = (
                "\\fscx96\\fscy96\\fad(100,160)"
                "\\t(0,260,\\fscx106\\fscy106)"
                "\\t(260,560,\\fscx100\\fscy100)"
            )
            border_width = 3
        else:
            transform_tags = (
                "\\fscx92\\fscy92\\fad(120,180)"
                "\\t(0,220,\\fscx112\\fscy112)"
                "\\t(220,520,\\fscx100\\fscy100)"
            )
            border_width = 3

        if is_editorial_image:
            escaped_text = _format_ass_text_with_word_opacity(
                wrapped,
                end_ms - start_ms,
                highlight_words=clip.important_words,
                primary_color=primary_color,
                accent_color=accent_color,
                font_name=font_name,
            )
        else:
            escaped_text = _format_ass_text_with_highlights(
                wrapped,
                clip.important_words,
                primary_color,
                accent_color,
            )
        start = ms_to_ass_time(start_ms)
        end = ms_to_ass_time(end_ms)

        # ASS transform tags give a lightweight production-safe motion feel in export.
        # The frontend preview uses richer CSS animation, while export stays FFmpeg-only.
        events.append(
            f"Dialogue: 1,{start},{end},Motion,,0,0,0,,"
            "{"
            f"\\an7\\pos(0,0)\\p1\\bord0\\shad0\\c{solid_bg_color}"
            "}"
            f"m 0 0 l {video_width} 0 l {video_width} {video_height} l 0 {video_height}"
        )
        events.extend(_motion_accent_ass_events(
            clip,
            start,
            end,
            accent_color,
            video_width,
            video_height,
        ))
        if is_editorial_image:
            ghost_words = [word for word in re.findall(r"[A-Za-z0-9']+", text) if word]
            ghost_text = " ".join(ghost_words[-2:] or ghost_words[:2] or [text])
            ghost_size = int(round(_clamp(font_size * (2.45 if video_height > video_width else 2.0), 64, 190, 110)))
            events.append(
                f"Dialogue: 1,{start},{end},Motion,,0,0,0,,"
                "{"
                f"\\an5\\pos({video_width // 2},{int(video_height * (0.68 if video_height > video_width else 0.70))})"
                f"\\fnSource Serif 4\\fs{ghost_size}\\i1\\b1\\bord0\\shad0"
                f"\\c{primary_color}\\alpha&HE2&\\fad(180,220)"
                "}"
                f"{_escape_ass_text(ghost_text)}"
            )
        overrides = (
            "{"
            f"\\an{alignment}\\pos({pos_x},{pos_y})\\fn{'Plus Jakarta Sans' if is_editorial_image else font_name}\\fs{font_size}"
            f"\\b1\\bord{border_width}\\shad0"
            f"{primary_tag}{outline_tag}{back_tag}"
            f"{transform_tags}"
            "}"
        )
        events.append(
            f"Dialogue: 2,{start},{end},Motion,,0,0,0,,"
            f"{overrides}{escaped_text}"
        )

    return "\n".join(events) + ("\n" if events else "")


def generate_ass_content(
    cues: List[CueInput],
    style: CaptionStyle,
    video_width: int = 1280,
    video_height: int = 720,
    preview_viewport: Optional[PreviewViewport] = None,
    motion_graphics_track: Optional[List[MotionGraphicsTrackInput]] = None,
) -> str:
    """Generate an ASS subtitle file from cues and style config."""
    text_opacity = _clamp(style.textOpacity, 0.0, 1.0, 1.0)
    primary_color = css_to_ass_color(style.color, (255, 255, 255, 1.0), text_opacity)
    highlight_source = style.highlightTextColor or style.highlightColor or "#FFD400"
    highlight_color = css_to_ass_color(highlight_source, (255, 212, 0, 1.0), text_opacity)
    position = str(style.position or "bottom").strip().lower()
    align = str(style.align or "center").strip().lower()

    # ASS alignment: 1=bottom-left, 2=bottom-center, 3=bottom-right,
    #                4=mid-left, 5=mid-center, 6=mid-right,
    #                7=top-left, 8=top-center, 9=top-right
    alignment_map = {
        ("bottom", "left"): 1, ("bottom", "center"): 2, ("bottom", "right"): 3,
        ("center", "left"): 4, ("center", "center"): 5, ("center", "right"): 6,
        ("top", "left"): 7, ("top", "center"): 8, ("top", "right"): 9,
    }
    alignment = alignment_map.get((position, align), 2)

    # Match frontend safe-area spacing: 6% horizontal, 8% vertical.
    margin_h = int(round(video_width * 0.06))
    margin_v = int(round(video_height * 0.08)) if position in ("top", "bottom") else 0

    font_name = _sanitize_ass_font_name(style.fontFamily)

    bold = -1 if style.fontWeight >= 700 else 0
    italic = -1 if style.italic else 0
    underline = -1 if style.underline else 0
    style_scale = _caption_scale_for_export(video_width, video_height, preview_viewport)
    spacing = _clamp(style.letterSpacing * style_scale, 0, 10, 0)
    font_size = int(round(_clamp(style.fontSize * style_scale, 10, 120, 28)))
    stroke_rgba = _parse_css_color(style.strokeColor, (0, 0, 0, 1.0))
    stroke_visible = stroke_rgba[3] > 0 and str(style.strokeColor or "").strip().lower() not in {"transparent", "none"}
    stroke_width = round(_clamp(style.strokeWidth * style_scale, 0, 12, 2), 2) if stroke_visible else 0.0
    outline_color = css_to_ass_color(style.strokeColor, (0, 0, 0, 1.0))

    background_rgba = _parse_css_color(style.background, (0, 0, 0, 0.0))
    background_visible = background_rgba[3] > 0 and str(style.background or "").strip().lower() not in {"transparent", "none", ""}
    border_style = 3 if background_visible else 1

    shadow_rgba = _parse_css_color(style.shadowColor, (0, 0, 0, 0.88))
    shadow_visible = shadow_rgba[3] > 0
    shadow_strength = round(_clamp((1.0 if shadow_visible or not background_visible else 0.0) * style_scale, 0.0, 8.0, 1.0), 2)

    if background_visible:
        back_color = css_to_ass_color(style.background, (0, 0, 0, 0.75))
    elif shadow_visible:
        back_color = css_to_ass_color(style.shadowColor, (0, 0, 0, 0.88))
    else:
        back_color = css_to_ass_color("rgba(0,0,0,0.88)", (0, 0, 0, 0.88))

    caption_mode = str(style.captionMode or "chunk").strip().lower()
    max_chars = _estimate_max_chars(video_width, style.maxWidthPct, font_size, spacing)
    position_override = _build_position_override(style, video_width, video_height, style_scale)

    ass = f"""[Script Info]
Title: SubtitleAI Pro Export
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF&,{outline_color},{back_color},{bold},{italic},{underline},0,100,100,{spacing},0,{border_style},{stroke_width},{shadow_strength},{alignment},{margin_h},{margin_h},{margin_v},1
Style: Motion,{font_name},{max(32, int(font_size * 1.35))},{primary_color},&H000000FF&,{outline_color},{back_color},-1,0,0,0,100,100,0,0,3,2,0,5,{margin_h},{margin_h},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    for cue in cues:
        segments = _word_mode_segments(cue) if caption_mode == "word" else [(cue.start_ms, cue.end_ms, cue.text or "")]
        for seg_start_ms, seg_end_ms, seg_text in segments:
            if seg_end_ms <= seg_start_ms:
                continue
            start = ms_to_ass_time(seg_start_ms)
            end = ms_to_ass_time(seg_end_ms)
            text = _apply_text_case(seg_text, style.textCase, style.uppercase)
            wrapped_text = text if caption_mode == "word" else _wrap_caption_text(text, max_chars)
            escaped_text = _format_ass_text_with_highlights(
                wrapped_text,
                cue.highlight_words,
                primary_color,
                highlight_color,
            )
            ass += f"Dialogue: 0,{start},{end},Default,,0,0,0,,{position_override}{escaped_text}\n"

        if caption_mode != "word" and cue.emoji and cue.emoji_start_ms is not None and cue.emoji_end_ms is not None:
            emoji_start_ms = max(cue.start_ms, int(cue.emoji_start_ms))
            emoji_end_ms = min(cue.end_ms, int(cue.emoji_end_ms))
            if emoji_end_ms > emoji_start_ms:
                emoji_start = ms_to_ass_time(emoji_start_ms)
                emoji_end = ms_to_ass_time(emoji_end_ms)
                emoji_override = _build_emoji_position_override(
                    style,
                    video_width,
                    video_height,
                    style_scale,
                    font_size,
                )
                emoji_text = _format_ass_emoji_text(
                    cue.emoji,
                    font_size=font_size,
                    primary_color=primary_color,
                    style_scale=style_scale,
                )
                if emoji_text:
                    ass += f"Dialogue: 1,{emoji_start},{emoji_end},Default,,0,0,0,,{emoji_override}{emoji_text}\n"

    ass += _motion_graphics_ass_events(
        motion_graphics_track,
        video_width=video_width,
        video_height=video_height,
        font_name=font_name,
    )

    return ass


# ─── Media Downloader ────────────────────────────────────────────────────────
def _domain_is_allowed(domain: str, allowed_domains: set[str]) -> bool:
    return any(domain == allowed or domain.endswith(f".{allowed}") for allowed in allowed_domains)


def _validate_media_url(url: str, allowed_domains: set[str], media_label: str) -> None:
    """SEC-07: Validate external URL against allowlisted domains to prevent SSRF."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if parsed.scheme not in ("https", "http"):
            raise ValueError(f"Invalid URL scheme: {parsed.scheme}")
        if not _domain_is_allowed(domain, allowed_domains):
            raise ValueError(f"{media_label} URL domain not allowed: {domain}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid {media_label} URL: {e}")


async def download_file(url: str, dest_path: str, allowed_domains: set[str], media_label: str):
    _validate_media_url(url, allowed_domains, media_label)

    def _download():
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            return
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response, open(dest_path, 'wb') as f:
            f.write(response.read())

    await asyncio.to_thread(_download)


def _cleanup_old_exports(export_dir: str, ttl_seconds: int = EXPORT_TTL_SECONDS) -> None:
    """ARCH-05: Delete export files older than ttl_seconds from the export dir."""
    try:
        cutoff = time.time() - ttl_seconds
        for fname in os.listdir(export_dir):
            fpath = os.path.join(export_dir, fname)
            if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
                os.unlink(fpath)
                logger.info(f'"Deleted old export file: {fname}"')
    except Exception as e:
        logger.warning(f'"Export cleanup warning: {e}"')


def _safe_asset_id(raw: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", (raw or "").strip())
    return value[:120] or "clip"


def _safe_broll_id(raw: str) -> str:
    return _safe_asset_id(raw)


def _normalize_broll_window_ms(start_ms: int, end_ms: int) -> tuple[int, int]:
    start = max(0, int(start_ms))
    requested_end = int(end_ms)
    if requested_end <= start:
        requested_end = start + 34
    capped_end = min(requested_end, start + 3000)
    return start, max(start + 1, capped_end)


def _normalize_timeline_window_ms(
    start_ms: int,
    end_ms: Optional[int],
    duration_hint_ms: int,
    video_duration_ms: int,
    min_duration_ms: int,
) -> tuple[int, int]:
    start = max(0, int(start_ms))
    requested_end = int(end_ms) if end_ms is not None else 0
    if requested_end <= start:
        requested_end = start + max(min_duration_ms, duration_hint_ms)
    if video_duration_ms > 0:
        requested_end = min(requested_end, video_duration_ms)
        max_start = max(0, video_duration_ms - min_duration_ms)
        start = min(start, max_start)
    if requested_end <= start:
        requested_end = start + min_duration_ms
        if video_duration_ms > 0:
            requested_end = min(requested_end, video_duration_ms)
    return start, max(start + 1, requested_end)


def _resolve_music_window(track: MusicTrackInput, video_duration_ms: int) -> dict:
    duration_hint_ms = int(max(0.0, float(track.duration or 0)) * 1000)
    start_ms, end_ms = _normalize_timeline_window_ms(
        track.start_ms,
        track.end_ms,
        duration_hint_ms,
        video_duration_ms,
        min_duration_ms=1000,
    )
    trim_start_ms = max(0, int(track.trim_start_ms))
    trim_end_ms = int(track.trim_end_ms) if track.trim_end_ms is not None else trim_start_ms + (end_ms - start_ms)
    if trim_end_ms <= trim_start_ms:
        trim_end_ms = trim_start_ms + (end_ms - start_ms)
    return {
        "start_ms": start_ms,
        "end_ms": end_ms,
        "trim_start_ms": trim_start_ms,
        "trim_end_ms": trim_end_ms,
        "volume_db": float(_clamp(float(track.volume_db), -40.0, 8.0, DEFAULT_MUSIC_VOLUME_DB)),
    }


def _resolve_sfx_window(track: SfxTrackInput, video_duration_ms: int) -> dict:
    duration_hint_ms = int(max(0.0, float(track.duration or 0)) * 1000)
    start_ms, end_ms = _normalize_timeline_window_ms(
        track.start_ms,
        track.end_ms,
        duration_hint_ms,
        video_duration_ms,
        min_duration_ms=90,
    )
    trim_start_ms = max(0, int(track.trim_start_ms))
    trim_end_ms = int(track.trim_end_ms) if track.trim_end_ms is not None else trim_start_ms + (end_ms - start_ms)
    if trim_end_ms <= trim_start_ms:
        trim_end_ms = trim_start_ms + (end_ms - start_ms)
    return {
        "start_ms": start_ms,
        "end_ms": end_ms,
        "trim_start_ms": trim_start_ms,
        "trim_end_ms": trim_end_ms,
        "volume_db": float(_clamp(float(track.volume_db), -30.0, 10.0, DEFAULT_SFX_VOLUME_DB)),
    }


def _probe_media_duration_seconds(media_path: str) -> float:
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


def _probe_has_audio_stream(media_path: str) -> bool:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=index",
                "-of",
                "csv=p=0",
                media_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0 and bool((result.stdout or "").strip())
    except Exception:
        return False


def _infer_extension_from_url(url: str, fallback: str) -> str:
    try:
        path = urlparse(url).path
        ext = os.path.splitext(path)[1].lower()
        if re.fullmatch(r"\.[a-z0-9]{1,5}", ext):
            return ext
    except Exception:
        pass
    return fallback


# ─── Export Endpoint ─────────────────────────────────────────────────────────

@router.post("/{project_id}/mp4")
@limiter.limit("3/minute")  # ARCH-04: max 3 exports per IP per minute
async def export_mp4(
    request: Request,
    project_id: str,
    body: ExportRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Burn captions and B-roll clips into video and return MP4."""
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    input_path = project.get("media_url")
    if not input_path or not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    if not body.cues:
        raise HTTPException(status_code=400, detail="No captions provided")

    style = await _resolve_export_style(db, project_id, user_id, body.style)

    # Determine target dimensions
    ar = body.target_aspect_ratio or "original"
    target_w, target_h = 1280, 720
    if ar == "9:16":
        target_w, target_h = 720, 1280
    elif ar == "1:1":
        target_w, target_h = 1080, 1080
    elif ar == "4:5":
        target_w, target_h = 1080, 1350

    # Generate ASS subtitle file
    ass_content = generate_ass_content(
        body.cues,
        style,
        video_width=target_w,
        video_height=target_h,
        preview_viewport=body.preview_viewport,
        motion_graphics_track=body.motion_graphics_track,
    )
    ass_path = os.path.join("uploads", f"temp_{project_id}.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    export_dir = os.path.join("uploads", "exports")
    os.makedirs(export_dir, exist_ok=True)
    output_path = os.path.join(export_dir, f"{project_id}_720p.mp4")

    # Cache setup
    broll_cache_dir = os.path.join("uploads", "broll_cache")
    audio_cache_dir = os.path.join("uploads", "audio_cache")
    image_cache_dir = os.path.join("uploads", "motion_image_cache")
    os.makedirs(broll_cache_dir, exist_ok=True)
    os.makedirs(audio_cache_dir, exist_ok=True)
    os.makedirs(image_cache_dir, exist_ok=True)

    cues_duration_ms = max((int(c.end_ms) for c in body.cues), default=0)
    probed_duration_s = _probe_media_duration_seconds(input_path)
    video_duration_ms = max(cues_duration_ms, int(round(probed_duration_s * 1000)), 1000)
    video_duration_s = max(0.1, video_duration_ms / 1000.0)
    has_primary_audio = _probe_has_audio_stream(input_path)

    # Build B-roll overlays from explicit timeline clips first; fallback to cue-attached clips.
    broll_jobs: list[asyncio.Future] = []
    broll_tracks: list[dict] = []  # list of dicts: { path, start, end }

    timeline_broll = body.broll_track or []
    if timeline_broll:
        for idx, clip in enumerate(timeline_broll):
            if not clip.video_url:
                continue
            broll_id = _safe_broll_id(clip.pexels_id or f"track_{idx}_{clip.start_ms}")
            dest_path = os.path.join(broll_cache_dir, f"{broll_id}.mp4")
            start_ms, end_ms = _normalize_broll_window_ms(clip.start_ms, clip.end_ms)
            broll_tracks.append({
                "path": dest_path,
                "start": float(start_ms) / 1000.0,
                "end": float(end_ms) / 1000.0,
            })
            broll_jobs.append(download_file(clip.video_url, dest_path, ALLOWED_BROLL_DOMAINS, "B-roll"))
    else:
        for cue in body.cues:
            if cue.broll and cue.broll.get("video_url"):
                broll_id = _safe_broll_id(str(cue.broll.get("pexels_id", f"{cue.start_ms}")))
                dest_path = os.path.join(broll_cache_dir, f"{broll_id}.mp4")
                start_ms, end_ms = _normalize_broll_window_ms(cue.start_ms, cue.end_ms)
                broll_tracks.append({
                    "path": dest_path,
                    "start": float(start_ms) / 1000.0,
                    "end": float(end_ms) / 1000.0,
                })
                broll_jobs.append(download_file(cue.broll["video_url"], dest_path, ALLOWED_BROLL_DOMAINS, "B-roll"))

    # Wait for all B-roll downloads
    if broll_jobs:
        logger.info(f"Downloading {len(broll_jobs)} B-roll clips for project {project_id}...")
        try:
            await asyncio.gather(*broll_jobs)
        except Exception as e:
            logger.error(f"Failed during B-roll download: {e}")

    # Build timed image overlays for the editorial motion-graphic treatment.
    image_jobs: list[asyncio.Future] = []
    image_tracks: list[dict] = []  # { path, start, end }

    for idx, clip in enumerate(body.motion_graphics_track or []):
        if _motion_visual_mode(clip) != "editorial_image":
            continue
        image_url = str(clip.image_url or "").strip()
        if not image_url:
            continue
        start_ms = max(0, min(int(clip.start_ms), max(0, video_duration_ms - 1)))
        requested_end_ms = max(start_ms + 1, int(clip.end_ms))
        end_ms = min(requested_end_ms, start_ms + 3000, video_duration_ms)
        if end_ms <= start_ms:
            continue
        ext = _infer_extension_from_url(image_url, ".jpg")
        image_id = _safe_asset_id(
            f"motion_image_{project_id}_{idx}_{start_ms}_{clip.image_pexels_id or clip.clip_id}"
        )
        image_path = os.path.join(image_cache_dir, f"{image_id}{ext}")
        image_tracks.append({
            "path": image_path,
            "start": float(start_ms) / 1000.0,
            "end": float(end_ms) / 1000.0,
        })
        image_jobs.append(download_file(image_url, image_path, ALLOWED_IMAGE_DOMAINS, "motion image"))

    if image_jobs:
        logger.info(f"Downloading {len(image_jobs)} motion graphic images for project {project_id}...")
        try:
            await asyncio.gather(*image_jobs)
        except Exception as e:
            logger.error(f"Failed during motion image download: {e}")

    # Build audio overlays from timeline tracks.
    audio_jobs: list[asyncio.Future] = []
    audio_tracks: list[dict] = []  # { path, start_ms, end_ms, trim_start_ms, trim_end_ms, volume_db, kind }

    if body.music_track and body.music_track.preview_url:
        music_url = str(body.music_track.preview_url).strip()
        if music_url:
            music_window = _resolve_music_window(body.music_track, video_duration_ms)
            if music_window["end_ms"] > music_window["start_ms"]:
                ext = _infer_extension_from_url(music_url, ".m4a")
                music_id = _safe_asset_id(f"music_{project_id}_{music_window['start_ms']}")
                music_path = os.path.join(audio_cache_dir, f"{music_id}{ext}")
                audio_tracks.append({
                    "kind": "music",
                    "path": music_path,
                    "start_ms": music_window["start_ms"],
                    "end_ms": music_window["end_ms"],
                    "trim_start_ms": music_window["trim_start_ms"],
                    "trim_end_ms": music_window["trim_end_ms"],
                    "volume_db": music_window["volume_db"],
                })
                audio_jobs.append(download_file(music_url, music_path, ALLOWED_AUDIO_DOMAINS, "audio"))

    for idx, sfx in enumerate(body.sfx_track or []):
        sfx_url = str(sfx.file_url or "").strip()
        if not sfx_url:
            continue
        sfx_window = _resolve_sfx_window(sfx, video_duration_ms)
        if sfx_window["end_ms"] <= sfx_window["start_ms"]:
            continue
        ext = _infer_extension_from_url(sfx_url, ".m4a")
        sfx_id = _safe_asset_id(f"sfx_{project_id}_{idx}_{sfx_window['start_ms']}")
        sfx_path = os.path.join(audio_cache_dir, f"{sfx_id}{ext}")
        audio_tracks.append({
            "kind": "sfx",
            "path": sfx_path,
            "start_ms": sfx_window["start_ms"],
            "end_ms": sfx_window["end_ms"],
            "trim_start_ms": sfx_window["trim_start_ms"],
            "trim_end_ms": sfx_window["trim_end_ms"],
            "volume_db": sfx_window["volume_db"],
        })
        audio_jobs.append(download_file(sfx_url, sfx_path, ALLOWED_AUDIO_DOMAINS, "audio"))

    if audio_jobs:
        logger.info(f"Downloading {len(audio_jobs)} audio overlays for project {project_id}...")
        try:
            await asyncio.gather(*audio_jobs)
        except Exception as e:
            logger.error(f"Failed during audio download: {e}")

    broll_tracks = [
        bt for bt in broll_tracks
        if os.path.exists(bt["path"]) and os.path.getsize(bt["path"]) > 0
    ]
    image_tracks = [
        it for it in image_tracks
        if os.path.exists(it["path"]) and os.path.getsize(it["path"]) > 0
    ]
    audio_tracks = [
        at for at in audio_tracks
        if os.path.exists(at["path"]) and os.path.getsize(at["path"]) > 0 and _probe_has_audio_stream(at["path"])
    ]

    try:
        ass_path_forward = ass_path.replace("\\", "/")
        ass_filter = _ass_filter(ass_path_forward)

        cmd = ["ffmpeg", "-y", "-i", input_path]

        for bt in broll_tracks:
            cmd.extend(["-i", bt["path"]])
        broll_input_count = len(broll_tracks)

        for image_track in image_tracks:
            cmd.extend(["-loop", "1", "-t", f"{video_duration_s:.3f}", "-i", image_track["path"]])
        image_input_count = len(image_tracks)

        for idx, at in enumerate(audio_tracks):
            at["input_index"] = 1 + broll_input_count + image_input_count + idx
            cmd.extend(["-i", at["path"]])

        if ar == "original":
            base_scale = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1"
        else:
            base_scale = f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h},setsar=1"

        needs_filter_complex = bool(broll_tracks or image_tracks or audio_tracks)
        if not needs_filter_complex:
            cmd.extend([
                "-vf", f"{base_scale},{ass_filter}",
                "-map", "0:v",
                "-map", "0:a?",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                output_path,
            ])
        else:
            filter_parts: list[str] = []
            filter_parts.append(f"[0:v]{base_scale}[bg]")
            last_out = "[bg]"

            for i, bt in enumerate(broll_tracks):
                idx = i + 1
                start = bt["start"]
                end = bt["end"]
                filter_parts.append(
                    f"[{idx}:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h},setsar=1,setpts=PTS-STARTPTS+{start}/TB[b{idx}]"
                )
                next_out = f"[v{idx}]"
                filter_parts.append(
                    f"{last_out}[b{idx}]overlay=enable='between(t,{start},{end})':eof_action=pass{next_out}"
                )
                last_out = next_out

            filter_parts.append(f"{last_out}{ass_filter}[vass]")
            last_out = "[vass]"

            image_w = int(target_w * (0.58 if target_h > target_w else 0.36))
            image_h = int(target_h * (0.31 if target_h > target_w else 0.36))
            image_x = int((target_w - image_w) / 2)
            image_y = int(target_h * (0.40 if target_h > target_w else 0.39))
            for i, image_track in enumerate(image_tracks):
                input_idx = 1 + broll_input_count + i
                start = image_track["start"]
                end = image_track["end"]
                image_label = f"[mimg{i}]"
                filter_parts.append(
                    f"[{input_idx}:v]scale={image_w}:{image_h}:force_original_aspect_ratio=increase,crop={image_w}:{image_h},format=rgba,setpts=PTS-STARTPTS+{start}/TB{image_label}"
                )
                next_out = f"[vimg{i}]"
                filter_parts.append(
                    f"{last_out}{image_label}overlay=x={image_x}:y={image_y}:enable='between(t,{start},{end})':eof_action=pass{next_out}"
                )
                last_out = next_out

            filter_parts.append(f"{last_out}format=yuv420p[outv]")

            if audio_tracks:
                if has_primary_audio:
                    filter_parts.append(
                        "[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[basea]"
                    )
                else:
                    filter_parts.append(
                        f"anullsrc=channel_layout=stereo:sample_rate=48000,atrim=0:{video_duration_s:.3f}[basea]"
                    )

                overlay_labels: list[str] = []
                for idx, at in enumerate(audio_tracks):
                    input_index = int(at["input_index"])
                    start_ms = int(at["start_ms"])
                    end_ms = int(at["end_ms"])
                    clip_duration_s = max(0.05, (end_ms - start_ms) / 1000.0)
                    trim_start_s = max(0.0, float(at["trim_start_ms"]) / 1000.0)
                    trim_end_s = max(trim_start_s + clip_duration_s, float(at["trim_end_ms"]) / 1000.0)
                    delay_ms = max(0, start_ms)
                    volume_db = float(at["volume_db"])

                    if at["kind"] == "music":
                        fade_in_s = min(0.35, clip_duration_s * 0.2)
                        fade_out_s = min(0.55, clip_duration_s * 0.25)
                    else:
                        fade_in_s = min(0.07, clip_duration_s * 0.25)
                        fade_out_s = min(0.12, clip_duration_s * 0.35)
                    fade_out_start_s = max(0.0, clip_duration_s - fade_out_s)

                    out_label = f"[aov{idx}]"
                    chain = (
                        f"[{input_index}:a]"
                        "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
                        f"atrim=start={trim_start_s:.3f}:end={trim_end_s:.3f},"
                        "asetpts=PTS-STARTPTS,"
                        f"volume={volume_db:.2f}dB"
                    )
                    if clip_duration_s > 0.12:
                        chain += f",afade=t=in:st=0:d={fade_in_s:.3f},afade=t=out:st={fade_out_start_s:.3f}:d={fade_out_s:.3f}"
                    chain += f",adelay={delay_ms}|{delay_ms}{out_label}"
                    filter_parts.append(chain)
                    overlay_labels.append(out_label)

                mix_chain = "[basea]" + "".join(overlay_labels)
                filter_parts.append(
                    f"{mix_chain}amix=inputs={len(overlay_labels) + 1}:duration=first:dropout_transition=0:normalize=0[aout]"
                )

            filter_complex = ";".join(filter_parts)
            cmd.extend(["-filter_complex", filter_complex, "-map", "[outv]"])
            if audio_tracks:
                cmd.extend(["-map", "[aout]"])
            else:
                cmd.extend(["-map", "0:a?"])
            cmd.extend([
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                "-shortest",
                output_path,
            ])

        logger.info(
            f"Running FFmpeg export (B-roll={len(broll_tracks)}, motion_images={len(image_tracks)}, audio_overlays={len(audio_tracks)}): {' '.join(cmd)}"
        )

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            logger.error(f'"FFmpeg export failed for project {project_id}", "stderr_tail": "{result.stderr[-300:] if result.stderr else ""}"')
            raise HTTPException(
                status_code=500,
                detail="Video export failed. Please try again or contact support.",
            )

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Export file was not created")

        # ARCH-05: clean up old exports in the background (non-blocking)
        asyncio.create_task(asyncio.to_thread(_cleanup_old_exports, export_dir))

        project_name = project.get("name", "export")
        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"{project_name}_720p.mp4",
            headers={"Content-Disposition": f'attachment; filename="{project_name}_720p.mp4"'},
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Export timed out — video may be too long")
    finally:
        # Clean up temp ASS file
        try:
            os.unlink(ass_path)
        except OSError:
            pass
