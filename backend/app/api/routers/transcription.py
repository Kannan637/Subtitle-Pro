import math
import logging
import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.database import get_database
from app.core.security import get_current_active_user, require_credits
from app.services.groq_service import transcribe_audio
from app.services.subtitle_service import segments_to_cues
from app.services.credit_service import deduct_credits

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/transcription", tags=["Transcription"])


def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/{project_id}")
async def start_transcription(
    project_id: str,
    language: str = "auto",
    model: str = "whisper-large-v3-turbo",
    current_user: dict = Depends(require_credits(1)),
    db=Depends(get_database),
):
    """Transcribe the media file associated with a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Verify project ownership
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find associated media file
    media = await db.media_files.find_one({"project_id": project_id})
    if not media:
        raise HTTPException(status_code=400, detail="No media file uploaded for this project")

    file_path = media.get("local_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="Media file path not found")

    # Mark project as processing
    await db.projects.update_one(
        {"_id": obj_id},
        {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc)}},
    )

    try:
        # Create transcription job record
        job = {
            "project_id": project_id,
            "status": "processing",
            "model_used": model,
            "source_lang": language if language != "auto" else None,
            "started_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }
        job_result = await db.transcription_jobs.insert_one(job)

        # Call Groq Whisper (sync function, run in thread to avoid blocking)
        result = await asyncio.to_thread(
            transcribe_audio,
            file_path=file_path,
            language=language if language != "auto" else None,
            model=model,
        )

        duration_sec = result.get("duration", 0)
        detected_lang = result.get("language", "en")

        # Create original subtitle track
        track = {
            "project_id": project_id,
            "user_id": user_id,
            "language_code": detected_lang,
            "is_original": True,
            "created_by": "ai",
            "version": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        track_result = await db.subtitle_tracks.insert_one(track)
        track_id = str(track_result.inserted_id)

        # Convert segments to cues and insert
        cues = segments_to_cues(result.get("segments", []), track_id=track_id)
        if cues:
            for cue in cues:
                cue["created_at"] = datetime.now(timezone.utc)
                cue["updated_at"] = datetime.now(timezone.utc)
            await db.subtitle_cues.insert_many(cues)

        # Deduct credits (1 credit per minute, rounded up)
        credits_to_deduct = max(1, math.ceil(duration_sec / 60))
        try:
            await deduct_credits(
                db, user_id, credits_to_deduct,
                reference=str(job_result.inserted_id),
                note=f"Transcription: {project.get('name', 'Untitled')}",
            )
        except ValueError:
            logger.warning(f"Credit deduction failed for user {user_id}")

        # Update job and project status
        await db.transcription_jobs.update_one(
            {"_id": job_result.inserted_id},
            {"$set": {
                "status": "complete",
                "detected_lang": detected_lang,
                "completed_at": datetime.now(timezone.utc),
            }},
        )
        await db.projects.update_one(
            {"_id": obj_id},
            {"$set": {
                "status": "ready",
                "duration_sec": int(duration_sec),
                "updated_at": datetime.now(timezone.utc),
            }},
        )

        return {
            "status": "complete",
            "job_id": str(job_result.inserted_id),
            "track_id": track_id,
            "language": detected_lang,
            "duration_sec": int(duration_sec),
            "cue_count": len(cues),
            "credits_used": credits_to_deduct,
            "transcript": result.get("text", ""),
        }

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        # Mark as error
        await db.projects.update_one(
            {"_id": obj_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc)}},
        )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.get("/{project_id}")
async def get_transcription(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Get transcription status and result for a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job = await db.transcription_jobs.find_one({"project_id": project_id})
    if not job:
        return {"status": "none", "message": "No transcription found for this project"}

    # Get original track + cues
    track = await db.subtitle_tracks.find_one({
        "project_id": project_id, "is_original": True
    })

    cues = []
    if track:
        cursor = db.subtitle_cues.find(
            {"track_id": str(track["_id"])}
        ).sort("sequence", 1)
        async for cue in cursor:
            cues.append(fix_id(cue))

    return {
        "status": job.get("status", "unknown"),
        "job_id": str(job["_id"]),
        "model_used": job.get("model_used"),
        "detected_lang": job.get("detected_lang"),
        "track_id": str(track["_id"]) if track else None,
        "cue_count": len(cues),
        "cues": cues,
    }
