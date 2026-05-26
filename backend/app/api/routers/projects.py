from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone
from bson import ObjectId

from app.db.database import get_database
from app.models.project import ProjectCreate, ProjectResponse
from app.core.security import get_current_active_user

router = APIRouter(prefix="/projects", tags=["Projects"])

def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_projects(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    query: dict = {"user_id": user_id}
    if cursor:
        try:
            cursor_id = ObjectId(cursor)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid cursor")

        cursor_project = await db.projects.find_one({"_id": cursor_id, "user_id": user_id})
        if not cursor_project:
            raise HTTPException(status_code=400, detail="Invalid cursor")

        cursor_created_at = cursor_project.get("created_at")
        query["$or"] = [
            {"created_at": {"$lt": cursor_created_at}},
            {"created_at": cursor_created_at, "_id": {"$lt": cursor_id}},
        ]

    db_cursor = db.projects.find(query).sort([("created_at", -1), ("_id", -1)]).limit(limit + 1)
    projects = await db_cursor.to_list(length=limit + 1)
    page = projects[:limit]
    next_cursor = str(projects[limit]["_id"]) if len(projects) > limit else None

    return {
        "items": [ProjectResponse(**fix_id(p)) for p in page],
        "next_cursor": next_cursor,
    }

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    now = datetime.now(timezone.utc)
    project_dict = project_in.model_dump()
    project_dict.update({
        "user_id": user_id,
        "status": "processing",
        "created_at": now,
        "updated_at": now
    })

    result = await db.projects.insert_one(project_dict)
    created_project = await db.projects.find_one({"_id": result.inserted_id})
    
    return ProjectResponse(**fix_id(created_project))

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectResponse(**fix_id(project))

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    result = await db.projects.delete_one({"_id": obj_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    
    return None
