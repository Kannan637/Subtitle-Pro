from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone
from bson import ObjectId

from app.db.database import get_database
from app.models.project import ProjectCreate, ProjectResponse, ProjectDB
from app.core.security import get_current_active_user

router = APIRouter(prefix="/projects", tags=["Projects"])

def fix_id(doc: dict) -> dict:
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database)
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    cursor = db.projects.find({"user_id": user_id}).sort("created_at", -1)
    projects = await cursor.to_list(length=100)
    
    return [ProjectResponse(**fix_id(p)) for p in projects]

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
