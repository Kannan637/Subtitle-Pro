"""
MongoDB / Pydantic models — map 1-to-1 with PRD §3.6 data model.
All documents use string IDs (`_id` as ObjectId converted to str) and UTC timestamps.
"""
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field, ConfigDict


# ── Helpers ───────────────────────────────────────────────────────────────────
def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ── Enums ─────────────────────────────────────────────────────────────────────
class PlanType(str, PyEnum):
    FREE       = "free"
    CREATOR    = "creator"
    STUDIO     = "studio"
    ENTERPRISE = "enterprise"


class JobStatus(str, PyEnum):
    QUEUED     = "queued"
    PROCESSING = "processing"
    COMPLETE   = "complete"
    ERROR      = "error"


class LedgerType(str, PyEnum):
    CREDIT = "credit"
    DEBIT  = "debit"


# Plan hierarchy for RBAC comparison  (used by security.py)
PLAN_HIERARCHY: Dict[str, int] = {
    "free": 0,
    "creator": 1,
    "studio": 2,
    "enterprise": 3,
}


# ─────────────────────────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────────────────────────
class UserDB(BaseModel):
    """Full user document stored in `users` collection."""
    uid: str                                        # Firebase UID (primary key)
    email: str
    name: str = ""
    picture: str = ""
    plan: str = PlanType.FREE.value
    credits_remaining: int = 3600                   # seconds
    is_verified: bool = False
    is_active: bool = True
    email_verified: bool = False
    onboarding_completed: bool = False
    onboarding_data: Optional[Dict[str, Any]] = None
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class UserResponse(BaseModel):
    """Safe user response (no internal flags)."""
    uid: str
    email: str
    name: str = ""
    picture: str = ""
    plan: str = "free"
    credits_remaining: int = 3600
    is_active: bool = True
    email_verified: bool = False
    onboarding_completed: bool = False
    is_new_user: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Project
# ─────────────────────────────────────────────────────────────────────────────
class ProjectDB(BaseModel):
    """Project document stored in `projects` collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    status: str = JobStatus.QUEUED.value
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: Optional[str] = None
    name: str
    status: str = "queued"
    media_url: Optional[str] = None
    duration_sec: Optional[int] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────────────────────────
# MediaFile
# ─────────────────────────────────────────────────────────────────────────────
class MediaFileDB(BaseModel):
    """Media file document stored in `media_files` collection."""
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    s3_key: Optional[str] = None
    local_path: Optional[str] = None                # MVP local storage
    audio_s3_key: Optional[str] = None
    original_filename: str
    size_bytes: int
    mime_type: str = ""
    format: str = ""
    duration_seconds: Optional[float] = None
    thumbnail_s3_key: Optional[str] = None
    source_url: Optional[str] = None                # populated for URL imports
    created_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# TranscriptionJob
# ─────────────────────────────────────────────────────────────────────────────
class TranscriptionJobDB(BaseModel):
    """Transcription job document stored in `transcription_jobs` collection."""
    model_config = ConfigDict(protected_namespaces=())
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    celery_task_id: Optional[str] = None
    status: str = JobStatus.QUEUED.value
    model_used: Optional[str] = None                # e.g. "whisper-large-v3"
    source_lang: Optional[str] = None               # ISO 639-1
    detected_lang: Optional[str] = None
    lang_confidence: Optional[float] = None
    wer_score: Optional[float] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# SubtitleTrack  (one per language per project)
# ─────────────────────────────────────────────────────────────────────────────
class SubtitleTrackDB(BaseModel):
    """Subtitle track document stored in `subtitle_tracks` collection."""
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    language_code: str                              # ISO 639-1
    is_original: bool = False
    created_by: str = "ai"                          # "ai" | "human"
    version: int = 1
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# SubtitleCue  (individual timed text block)
# ─────────────────────────────────────────────────────────────────────────────
class SubtitleCueDB(BaseModel):
    """Subtitle cue document stored in `subtitle_cues` collection."""
    id: Optional[str] = Field(None, alias="_id")
    track_id: str
    sequence: int                                   # display order
    start_ms: int                                   # milliseconds
    end_ms: int                                     # milliseconds
    text: str
    speaker_id: Optional[str] = None                # e.g. "SPEAKER_01"
    confidence: Optional[float] = None              # 0.0 – 1.0
    line_position: str = "bottom"                   # bottom | top | center
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# TranslationJob
# ─────────────────────────────────────────────────────────────────────────────
class TranslationJobDB(BaseModel):
    """Translation job document stored in `translation_jobs` collection."""
    model_config = ConfigDict(protected_namespaces=())
    id: Optional[str] = Field(None, alias="_id")
    project_id: str
    source_track_id: str
    target_track_id: Optional[str] = None
    celery_task_id: Optional[str] = None
    target_language: str                            # ISO 639-1
    model_used: Optional[str] = None                # "deepl" | "gpt-4o"
    bleu_score: Optional[float] = None
    status: str = JobStatus.QUEUED.value
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# CreditLedger  (append-only debit/credit log)
# ─────────────────────────────────────────────────────────────────────────────
class CreditLedgerDB(BaseModel):
    """Credit ledger entry stored in `credit_ledger` collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    type: str                                       # "credit" | "debit"
    amount_sec: int                                 # seconds consumed/added
    reference: Optional[str] = None                 # job_id, stripe invoice, etc.
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


# ─────────────────────────────────────────────────────────────────────────────
# Subscription
# ─────────────────────────────────────────────────────────────────────────────
class SubscriptionDB(BaseModel):
    """Subscription document stored in `subscriptions` collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    ls_subscription_id: str = ""                    # Lemonsqueezy subscription ID
    ls_order_id: str = ""                           # Lemonsqueezy order ID
    plan: str                                       # free | creator | studio | enterprise
    status: str                                     # active | canceled | past_due | expired
    current_period_end: Optional[datetime] = None
    cancel_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)