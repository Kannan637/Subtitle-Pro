from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

def generate_utc_now() -> datetime:
    return datetime.now(timezone.utc)

class MediaFileBase(BaseModel):
    original_filename: str
    size_bytes: int
    format: str

class MediaFileCreate(MediaFileBase):
    pass

class MediaFileDB(MediaFileBase):
    id: str
    project_id: str
    s3_key: Optional[str] = None
    audio_s3_key: Optional[str] = None
    created_at: datetime = Field(default_factory=generate_utc_now)

class ProjectBase(BaseModel):
    name: str
    type: str = "subtitle"

class ProjectCreate(ProjectBase):
    pass

class ProjectDB(ProjectBase):
    id: str
    user_id: str
    media_url: Optional[str] = None
    duration_sec: Optional[int] = None
    status: str = "processing" # processing, completed, error
    created_at: datetime = Field(default_factory=generate_utc_now)
    updated_at: datetime = Field(default_factory=generate_utc_now)

class ProjectResponse(ProjectDB):
    pass
