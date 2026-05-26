"""Subtitles router — CRUD + export (SRT/VTT/TXT)."""
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional

from app.db.database import get_database
from app.core.security import get_current_active_user
from app.services.subtitle_service import export_srt, export_vtt, export_txt, export_json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subtitles", tags=["Subtitles"])


def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        value = str(doc.pop("_id"))
        doc["_id"] = value
        doc["id"] = value
    return doc


async def _ensure_track_owner(db, track_id: str, user_id: str) -> dict:
    track = await db.subtitle_tracks.find_one({"_id": ObjectId(track_id)})
    if not track:
        raise HTTPException(status_code=404, detail="Subtitle track not found")

    try:
        project_obj_id = ObjectId(track.get("project_id"))
    except Exception:
        raise HTTPException(status_code=404, detail="Project not found")

    project = await db.projects.find_one({"_id": project_obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return track


class CueUpdate(BaseModel):
    """BE-03: Validated cue update schema."""
    text: Optional[str] = None
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None

    @field_validator("text")
    @classmethod
    def text_max_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("text must be 500 characters or fewer")
        return v

    @field_validator("start_ms", "end_ms")
    @classmethod
    def validate_ms_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if v < 0:
                raise ValueError("timestamp must be >= 0")
            if v > 86_400_000:  # 24h in ms
                raise ValueError("timestamp must be <= 86400000 (24h)")
        return v

    @model_validator(mode="after")
    def start_before_end(self) -> "CueUpdate":
        if self.start_ms is not None and self.end_ms is not None:
            if self.start_ms >= self.end_ms:
                raise ValueError("start_ms must be less than end_ms")
        return self


@router.put("/cue/{cue_id}")
async def update_cue(
    cue_id: str,
    update: CueUpdate,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Update a single subtitle cue's text or timing."""
    try:
        obj_id = ObjectId(cue_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cue ID")

    cue = await db.subtitle_cues.find_one({"_id": obj_id})
    if not cue:
        raise HTTPException(status_code=404, detail="Cue not found")
    await _ensure_track_owner(db, cue["track_id"], current_user.get("uid"))

    update_data = {"updated_at": datetime.now(timezone.utc)}
    if update.text is not None:
        update_data["text"] = update.text
    if update.start_ms is not None:
        update_data["start_ms"] = update.start_ms
    if update.end_ms is not None:
        update_data["end_ms"] = update.end_ms

    await db.subtitle_cues.update_one({"_id": obj_id}, {"$set": update_data})
    updated = await db.subtitle_cues.find_one({"_id": obj_id})
    return fix_id(updated)


class BulkUpdateCues(BaseModel):
    cues: list[dict]

@router.put("/track/{project_id}")
async def bulk_update_cues(
    project_id: str,
    data: BulkUpdateCues,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Bulk update or insert cues for a project track. Handles automatic splits and trims."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    track = await db.subtitle_tracks.find_one({"project_id": project_id})
    if not track:
        raise HTTPException(status_code=404, detail="No subtitle track found")

    track_id = str(track["_id"])
    now = datetime.now(timezone.utc)

    kept_ids: set[ObjectId] = set()
    db_cues = []
    for i, c in enumerate(data.cues):
        text = str(c.get("text", "")).strip()
        start_ms = int(c.get("start_ms", 0) or 0)
        end_ms = int(c.get("end_ms", 0) or 0)
        if not text:
            continue
        if start_ms < 0 or end_ms <= start_ms:
            raise HTTPException(status_code=400, detail="Invalid cue timing")

        cue_doc = {
            "track_id": track_id,
            "sequence": i + 1,
            "start_ms": start_ms,
            "end_ms": end_ms,
            "text": text,
            "updated_at": now
        }
        
        c_id = c.get("_id") or c.get("id")
        if c_id and not c_id.startswith("split_"):
            try:
                real_id = ObjectId(c_id)
                result = await db.subtitle_cues.update_one(
                    {"_id": real_id, "track_id": track_id},
                    {"$set": cue_doc}
                )
                if result.matched_count:
                    kept_ids.add(real_id)
                else:
                    cue_doc["created_at"] = now
                    db_cues.append(cue_doc)
            except Exception:
                db_cues.append(cue_doc) # Invalid ObjectId means it's definitely new
        else:
            cue_doc["created_at"] = now
            db_cues.append(cue_doc)
            
    if db_cues:
        result = await db.subtitle_cues.insert_many(db_cues)
        kept_ids.update(result.inserted_ids)

    delete_query: dict = {"track_id": track_id}
    if kept_ids:
        delete_query["_id"] = {"$nin": list(kept_ids)}
    await db.subtitle_cues.delete_many(delete_query)

    refreshed = []
    cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
    async for cue in cursor:
        refreshed.append(fix_id(cue))

    return {"message": "Bulk update successful", "cues": refreshed}


@router.get("/export/{project_id}")
async def export_subtitles(
    project_id: str,
    format: str = Query("srt", description="Export format: srt, vtt, txt, json"),
    lang: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Export subtitles in SRT, VTT, TXT, or JSON format."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = {"project_id": project_id}
    if lang:
        query["language_code"] = lang
    else:
        query["is_original"] = True

    track = await db.subtitle_tracks.find_one(query)
    if not track:
        raise HTTPException(status_code=404, detail="No subtitle track found")

    track_id = str(track["_id"])
    cues_cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
    cues = []
    async for cue in cues_cursor:
        cues.append(fix_id(cue))

    if not cues:
        raise HTTPException(status_code=404, detail="No subtitle cues found")

    project_name = project.get("name", "subtitles")
    lang_code = track.get("language_code", "en")

    if format == "srt":
        content = export_srt(cues)
        return PlainTextResponse(
            content,
            media_type="application/x-subrip",
            headers={"Content-Disposition": f'attachment; filename="{project_name}_{lang_code}.srt"'},
        )
    elif format == "vtt":
        content = export_vtt(cues)
        return PlainTextResponse(
            content,
            media_type="text/vtt",
            headers={"Content-Disposition": f'attachment; filename="{project_name}_{lang_code}.vtt"'},
        )
    elif format == "txt":
        content = export_txt(cues)
        return PlainTextResponse(
            content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{project_name}_{lang_code}.txt"'},
        )
    elif format == "json":
        return {"cues": export_json(cues)}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")


@router.get("/{project_id}")
async def get_subtitles(
    project_id: str,
    lang: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Get all subtitle tracks and cues for a project."""
    user_id = current_user.get("uid")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find tracks
    query = {"project_id": project_id}
    if lang:
        query["language_code"] = lang

    tracks_cursor = db.subtitle_tracks.find(query)
    tracks = []
    async for track in tracks_cursor:
        track_id = str(track["_id"])
        # Load cues for this track
        cues_cursor = db.subtitle_cues.find({"track_id": track_id}).sort("sequence", 1)
        cues = []
        async for cue in cues_cursor:
            cues.append(fix_id(cue))

        tracks.append({
            "track_id": track_id,
            "language_code": track.get("language_code", ""),
            "is_original": track.get("is_original", False),
            "created_by": track.get("created_by", "ai"),
            "version": track.get("version", 1),
            "cues": cues,
        })

    return {"tracks": tracks}


# Routes /cue/{cue_id} and /export/{project_id} are defined ABOVE /{project_id}
# to avoid FastAPI treating 'cue' and 'export' as project IDs.
