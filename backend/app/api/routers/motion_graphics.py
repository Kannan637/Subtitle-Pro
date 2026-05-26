"""Motion graphics router - cue-driven animated callout suggestions."""
import asyncio
import logging
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import get_current_active_user
from app.db.database import get_database
from app.services.motion_graphics_service import generate_motion_graphics_suggestions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/motion-graphics", tags=["Motion graphics"])


class MotionGraphicsSuggestRequest(BaseModel):
    density: float = Field(0.35, ge=0.1, le=1.0)
    max_items: int = Field(12, ge=1, le=40)


class MotionGraphicSuggestion(BaseModel):
    clip_id: str
    cue_id: str
    text: str
    keyword: str
    source_text: str
    start_ms: int
    end_ms: int
    duration_ms: int
    importance: float
    style: str
    style_family: str = "cinematic_creator"
    moment_type: str = "explanation"
    motion_role: str = "secondary"
    motion_principle: str = "ease_out_overshoot"
    important_words: List[str] = Field(default_factory=list)
    shape: str
    animation: str
    placement: str
    accent_color: str
    background: str
    solid_background: str = "#F8FAFC"
    image_url: str = ""
    image_alt: str = ""
    image_pexels_id: str = ""
    image_credit: str = ""
    image_query: str = ""
    sound_cue: str = "soft_whoosh"
    editing_note: str = ""
    reason: str
    html: str


class MotionGraphicsSuggestResponse(BaseModel):
    project_id: str
    total_cues: int
    suggestions: List[MotionGraphicSuggestion]


@router.post("/{project_id}/suggest", response_model=MotionGraphicsSuggestResponse)
async def suggest_motion_graphics(
    project_id: str,
    body: MotionGraphicsSuggestRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    track = await db.subtitle_tracks.find_one({"project_id": project_id, "is_original": True})
    if not track:
        track = await db.subtitle_tracks.find_one({"project_id": project_id})
    if not track:
        raise HTTPException(status_code=400, detail="No subtitle track found. Run transcription first.")

    cues = []
    async for cue in db.subtitle_cues.find({"track_id": str(track["_id"])}).sort("sequence", 1):
        cues.append({
            "_id": str(cue["_id"]),
            "text": cue.get("text", ""),
            "start_ms": int(cue.get("start_ms", 0) or 0),
            "end_ms": int(cue.get("end_ms", 0) or 0),
            "words": cue.get("words") if isinstance(cue.get("words"), list) else [],
        })

    if not cues:
        raise HTTPException(status_code=400, detail="No subtitle cues found for this project.")

    logger.info("Generating motion graphics suggestions for project %s (%d cues)", project_id, len(cues))
    suggestions = await asyncio.to_thread(
        generate_motion_graphics_suggestions,
        cues,
        density=body.density,
        max_items=body.max_items,
    )

    return MotionGraphicsSuggestResponse(
        project_id=project_id,
        total_cues=len(cues),
        suggestions=suggestions,
    )
