from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse
import os
import shutil
import mimetypes
from datetime import datetime, timezone
from bson import ObjectId

from app.db.database import get_database
from app.core.security import get_current_active_user, require_credits

router = APIRouter(prefix="/media", tags=["Media"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

@router.post("/upload")
async def upload_media(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(require_credits(1)),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")

    # Verify project belongs to user
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Save file locally for MVP (instead of S3 to save time)
    file_path = os.path.join(UPLOAD_DIR, f"{project_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    media_data = {
        "project_id": project_id,
        "original_filename": file.filename,
        "size_bytes": file_size,
        "format": file.content_type,
        "local_path": file_path,
        "created_at": datetime.now(timezone.utc)
    }

    media_result = await db.media_files.insert_one(media_data)
    
    # Update project with media url and set status to ready
    await db.projects.update_one(
        {"_id": obj_id},
        {"$set": {"media_url": file_path, "status": "ready", "updated_at": datetime.now(timezone.utc)}}
    )

    return {"message": "Upload successful", "media_id": str(media_result.inserted_id), "file_path": file_path}


@router.get("/stream/{project_id}")
async def stream_media(
    project_id: str,
    request: Request,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    """Stream media file for HTML5 video playback with Range header support."""
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

    file_path = project.get("media_url")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    file_size = os.path.getsize(file_path)
    content_type = mimetypes.guess_type(file_path)[0] or "video/mp4"

    # Handle Range header for seeking
    range_header = request.headers.get("range")
    if range_header:
        range_val = range_header.strip().replace("bytes=", "")
        range_parts = range_val.split("-")
        start = int(range_parts[0])
        end = int(range_parts[1]) if range_parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(8192, remaining)
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_file(),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
                "Content-Type": content_type,
            },
        )

    # Full file response (no Range)
    return FileResponse(
        file_path,
        media_type=content_type,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )

