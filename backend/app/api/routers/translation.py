"""Translation router — Groq LLM-powered subtitle translation."""
import logging
import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List

from app.db.database import get_database
from app.core.security import get_current_active_user, require_plan
from app.services.groq_service import translate_subtitles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/translation", tags=["Translation"])


def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


class TranslateRequest(BaseModel):
    target_languages: List[str]  # ISO 639-1 codes
    tone: str = "neutral"        # formal / neutral / casual


@router.post("/{project_id}")
async def start_translation(
    project_id: str,
    request: TranslateRequest,
    current_user: dict = Depends(require_plan("creator")),
    db=Depends(get_database),
):
    """Translate subtitle track to one or more target languages."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Verify project
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find original subtitle track
    source_track = await db.subtitle_tracks.find_one({
        "project_id": project_id, "is_original": True
    })
    if not source_track:
        raise HTTPException(status_code=400, detail="No transcription found. Please transcribe first.")

    source_track_id = str(source_track["_id"])
    source_lang = source_track.get("language_code", "en")

    # Load source cues
    cursor = db.subtitle_cues.find({"track_id": source_track_id}).sort("sequence", 1)
    source_cues = []
    async for cue in cursor:
        source_cues.append(fix_id(cue))

    if not source_cues:
        raise HTTPException(status_code=400, detail="No subtitle cues found in source track")

    results = []

    for target_lang in request.target_languages:
        if target_lang == source_lang:
            continue

        try:
            # Create translation job
            job = {
                "project_id": project_id,
                "source_track_id": source_track_id,
                "target_language": target_lang,
                "status": "processing",
                "started_at": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc),
            }
            job_result = await db.translation_jobs.insert_one(job)

            # Call Groq LLM (sync function, run in thread)
            translated_cues = await asyncio.to_thread(
                translate_subtitles,
                cues=source_cues,
                source_lang=source_lang,
                target_lang=target_lang,
                tone=request.tone,
            )

            # Create new subtitle track for this language
            track = {
                "project_id": project_id,
                "user_id": user_id,
                "language_code": target_lang,
                "is_original": False,
                "created_by": "ai",
                "version": 1,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            track_result = await db.subtitle_tracks.insert_one(track)
            track_id = str(track_result.inserted_id)

            # Insert translated cues
            for cue in translated_cues:
                cue["track_id"] = track_id
                cue["created_at"] = datetime.now(timezone.utc)
                cue["updated_at"] = datetime.now(timezone.utc)
                # Remove MongoDB _id if present from source
                cue.pop("_id", None)

            if translated_cues:
                await db.subtitle_cues.insert_many(translated_cues)

            # Update job
            await db.translation_jobs.update_one(
                {"_id": job_result.inserted_id},
                {"$set": {
                    "status": "complete",
                    "target_track_id": track_id,
                    "model_used": "llama-3.3-70b-versatile",
                    "completed_at": datetime.now(timezone.utc),
                }},
            )

            results.append({
                "language": target_lang,
                "track_id": track_id,
                "cue_count": len(translated_cues),
                "status": "complete",
            })

        except Exception as e:
            logger.error(f"Translation to {target_lang} failed: {e}")
            results.append({
                "language": target_lang,
                "status": "error",
                "error": str(e),
            })

    return {"results": results}


@router.get("/{project_id}")
async def get_translations(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Get all translation tracks for a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all non-original tracks
    cursor = db.subtitle_tracks.find({
        "project_id": project_id, "is_original": False
    })
    tracks = []
    async for track in cursor:
        track_id = str(track["_id"])
        cue_count = await db.subtitle_cues.count_documents({"track_id": track_id})
        tracks.append({
            "track_id": track_id,
            "language_code": track.get("language_code"),
            "cue_count": cue_count,
            "created_at": track.get("created_at"),
        })

    return {"tracks": tracks}
