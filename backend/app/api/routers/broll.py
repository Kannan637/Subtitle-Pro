"""B-roll router — AI keyword extraction + Pexels clip suggestions."""
import asyncio
import logging
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db.database import get_database
from app.core.security import get_current_active_user
from app.services.broll_service import generate_broll_suggestions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/broll", tags=["B-roll"])


# ── Request / Response schemas ──────────────────────────────────────────────

class BrollSuggestRequest(BaseModel):
    coverage: float = Field(0.5, ge=0.1, le=1.0, description="Fraction of cues to fetch clips for")
    orientation: str = Field("landscape", description="landscape | portrait | square")


class BrollClip(BaseModel):
    video_url: str
    thumbnail: str
    width: int
    height: int
    duration: int
    pexels_id: str


class BrollSuggestion(BaseModel):
    cue_id: str
    text: str
    start_ms: int
    end_ms: int
    keyword: str
    importance: float = 0.0
    broll: Optional[BrollClip] = None


class BrollSuggestResponse(BaseModel):
    project_id: str
    total_cues: int
    clips_found: int
    suggestions: List[BrollSuggestion]


# ── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/suggest", response_model=BrollSuggestResponse)
async def suggest_broll(
    project_id: str,
    body: BrollSuggestRequest,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """
    Generate AI B-roll suggestions for all subtitle cues of a project.
    Uses Groq LLM to extract search keywords, then fetches Pexels clips.
    """
    user_id = current_user.get("uid")

    # Validate project
    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch cues from the original subtitle track
    track = await db.subtitle_tracks.find_one({"project_id": project_id, "is_original": True})
    if not track:
        raise HTTPException(status_code=400, detail="No subtitle track found. Run transcription first.")

    cues = []
    async for cue in db.subtitle_cues.find({"track_id": str(track["_id"])}).sort("sequence", 1):
        cues.append({
            "_id": str(cue["_id"]),
            "text": cue.get("text", ""),
            "start_ms": cue.get("start_ms", 0),
            "end_ms": cue.get("end_ms", 0),
        })

    if not cues:
        raise HTTPException(status_code=400, detail="No subtitle cues found for this project.")

    logger.info(f"Starting B-roll generation for project {project_id}: {len(cues)} cues")

    # Run in thread pool (sync Groq + Requests calls)
    results = await asyncio.to_thread(
        generate_broll_suggestions,
        cues,
        coverage=body.coverage,
        orientation=body.orientation,
    )

    clips_found = sum(1 for r in results if r.get("broll"))

    return BrollSuggestResponse(
        project_id=project_id,
        total_cues=len(results),
        clips_found=clips_found,
        suggestions=results,
    )


@router.get("/{project_id}/preview")
async def preview_broll_clip(
    project_id: str,
    keyword: str,
    orientation: str = "landscape",
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Fetch a single Pexels clip preview for a custom keyword. Used for manual B-roll swap."""
    from app.services.broll_service import fetch_pexels_video
    clip = await asyncio.to_thread(fetch_pexels_video, keyword, orientation)
    if not clip:
        raise HTTPException(status_code=404, detail=f"No Pexels video found for '{keyword}'")
    return clip
