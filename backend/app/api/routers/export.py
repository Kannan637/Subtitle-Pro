"""Export router — burn captions into video as MP4 720p via FFmpeg."""
import logging
import os
import subprocess
import tempfile
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db.database import get_database
from app.core.security import get_current_active_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/export", tags=["Export"])


# ─── Request Schema ──────────────────────────────────────────────────────────

class CueInput(BaseModel):
    text: str
    start_ms: int
    end_ms: int


class CaptionStyle(BaseModel):
    fontFamily: str = "Arial"
    fontSize: int = 28
    fontWeight: int = 800
    color: str = "#FFFFFF"
    strokeColor: str = "#000000"
    strokeWidth: int = 2
    position: str = "bottom"  # top | center | bottom
    align: str = "center"


class ExportRequest(BaseModel):
    cues: List[CueInput]
    style: Optional[CaptionStyle] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def hex_to_ass_color(hex_color: str) -> str:
    """Convert #RRGGBB hex to ASS color &HBBGGRR& format."""
    h = hex_color.lstrip("#")
    if len(h) == 8:
        h = h[:6]  # strip alpha
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}&"


def ms_to_ass_time(ms: int) -> str:
    """Convert milliseconds to ASS timestamp H:MM:SS.cc"""
    total_s = ms / 1000
    h = int(total_s // 3600)
    m = int((total_s % 3600) // 60)
    s = total_s % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def generate_ass_content(cues: List[CueInput], style: CaptionStyle, video_width: int = 1280, video_height: int = 720) -> str:
    """Generate an ASS subtitle file from cues and style config."""
    primary_color = hex_to_ass_color(style.color)
    outline_color = hex_to_ass_color(style.strokeColor)

    # ASS alignment: 1=bottom-left, 2=bottom-center, 3=bottom-right,
    #                4=mid-left, 5=mid-center, 6=mid-right,
    #                7=top-left, 8=top-center, 9=top-right
    alignment_map = {
        ("bottom", "left"): 1, ("bottom", "center"): 2, ("bottom", "right"): 3,
        ("center", "left"): 4, ("center", "center"): 5, ("center", "right"): 6,
        ("top", "left"): 7, ("top", "center"): 8, ("top", "right"): 9,
    }
    alignment = alignment_map.get((style.position, style.align), 2)

    # MarginV controls distance from edge
    margin_v = 40 if style.position in ("top", "bottom") else 0

    font_name = style.fontFamily if style.fontFamily != "Hobo" else "Arial"

    bold = -1 if style.fontWeight >= 700 else 0

    ass = f"""[Script Info]
Title: SubtitleAI Pro Export
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{style.fontSize},{primary_color},&H000000FF&,{outline_color},&H80000000&,{bold},0,0,0,100,100,0,0,1,{style.strokeWidth},0,{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    for cue in cues:
        start = ms_to_ass_time(cue.start_ms)
        end = ms_to_ass_time(cue.end_ms)
        # Escape special ASS characters
        text = cue.text.replace("\n", "\\N")
        ass += f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n"

    return ass


# ─── Export Endpoint ─────────────────────────────────────────────────────────

@router.post("/{project_id}/mp4")
async def export_mp4(
    project_id: str,
    body: ExportRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Burn captions into video and return 720p MP4."""
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

    style = body.style or CaptionStyle()

    # Generate ASS subtitle file
    ass_content = generate_ass_content(body.cues, style)

    # Write ASS to uploads directory (using relative path avoids Windows C: drive escaping issues in FFmpeg ass filter)
    ass_path = os.path.join("uploads", f"temp_{project_id}.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    # Output path
    export_dir = os.path.join("uploads", "exports")
    os.makedirs(export_dir, exist_ok=True)
    output_path = os.path.join(export_dir, f"{project_id}_720p.mp4")

    try:
        # Normalize the ASS path for FFmpeg relative path (use forward slashes)
        ass_path_forward = ass_path.replace("\\", "/")

        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-vf", f"scale=-2:720,ass='{ass_path_forward}'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ]

        logger.info(f"Running FFmpeg export: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
        )

        if result.returncode != 0:
            logger.error(f"FFmpeg stderr: {result.stderr}")
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg export failed: {result.stderr[-500:] if result.stderr else 'Unknown error'}",
            )

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Export file was not created")

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
