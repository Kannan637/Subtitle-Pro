from datetime import datetime, timezone
import re
from typing import Any, Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.security import get_current_active_user
from app.db.database import get_database

router = APIRouter(prefix="/control-panel", tags=["Control Panel"])


def _ensure_hex_or_transparent(value: str, field_name: str) -> str:
    val = value.strip()
    if val == "transparent":
        return val
    if len(val) in (4, 7) and val.startswith("#"):
        hex_part = val[1:]
        if all(ch in "0123456789abcdefABCDEF" for ch in hex_part):
            return val
    raise ValueError(f"{field_name} must be a hex color (e.g. #FFFFFF) or 'transparent'")


def _ensure_css_color(value: str, field_name: str) -> str:
    val = value.strip()
    if val == "transparent":
        return val
    if len(val) in (4, 7) and val.startswith("#"):
        hex_part = val[1:]
        if all(ch in "0123456789abcdefABCDEF" for ch in hex_part):
            return val
    if re.fullmatch(
        r"rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)",
        val,
    ):
        return val
    raise ValueError(
        f"{field_name} must be a CSS color (#RRGGBB, #RGB, transparent, rgb(...), rgba(...))"
    )


class CaptionStylePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fontFamily: str | None = Field(default=None, max_length=120)
    fontSize: float | None = Field(default=None, ge=10, le=80)
    fontWeight: int | None = Field(default=None, ge=100, le=900)
    italic: bool | None = None
    underline: bool | None = None
    uppercase: bool | None = None
    textCase: Literal["original", "upper", "lower", "title"] | None = None
    color: str | None = Field(default=None, max_length=20)
    strokeColor: str | None = Field(default=None, max_length=20)
    strokeWidth: float | None = Field(default=None, ge=0, le=10)
    shadowColor: str | None = Field(default=None, max_length=40)
    glowColor: str | None = Field(default=None, max_length=40)
    background: str | None = Field(default=None, max_length=40)
    borderRadius: float | None = Field(default=None, ge=0, le=30)
    highlightWord: bool | None = None
    highlightColor: str | None = Field(default=None, max_length=20)
    highlightTextColor: str | None = Field(default=None, max_length=20)
    align: Literal["left", "center", "right"] | None = None
    position: Literal["top", "center", "bottom"] | None = None
    offsetX: float | None = Field(default=None, ge=-240, le=240)
    offsetY: float | None = Field(default=None, ge=-240, le=240)
    maxWidthPct: float | None = Field(default=None, ge=40, le=100)
    textOpacity: float | None = Field(default=None, ge=0.2, le=1.0)
    enterAnim: str | None = Field(default=None, max_length=60)
    exitAnim: str | None = Field(default=None, max_length=60)
    animDuration: int | None = Field(default=None, ge=100, le=2000)
    animDelay: int | None = Field(default=None, ge=0, le=1000)
    lineHeight: float | None = Field(default=None, ge=1.0, le=2.0)
    letterSpacing: float | None = Field(default=None, ge=0, le=10)
    captionMode: Literal["word", "chunk", "sentence"] | None = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _ensure_hex_or_transparent(value, "color")

    @field_validator("strokeColor")
    @classmethod
    def validate_stroke_color(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _ensure_hex_or_transparent(value, "strokeColor")

    @field_validator("highlightColor", "highlightTextColor")
    @classmethod
    def validate_highlight_colors(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _ensure_hex_or_transparent(value, "highlight color")

    @field_validator("shadowColor", "glowColor", "background")
    @classmethod
    def validate_css_colors(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _ensure_css_color(value, "style color")


class ControlPanelSettingsUpsert(BaseModel):
    selected_template: str | None = Field(default=None, max_length=80)
    custom_style: CaptionStylePayload = Field(default_factory=CaptionStylePayload)
    resolved_style: CaptionStylePayload = Field(default_factory=CaptionStylePayload)


class ControlPanelSettingsResponse(BaseModel):
    project_id: str
    selected_template: str | None = None
    custom_style: dict[str, Any] = Field(default_factory=dict)
    resolved_style: dict[str, Any] = Field(default_factory=dict)
    updated_at: str = ""


async def _ensure_project_owner(db: Any, project_id: str, user_id: str) -> None:
    try:
        obj_id = ObjectId(project_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid project ID")
    project = await db.projects.find_one({"_id": obj_id, "user_id": user_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}", response_model=ControlPanelSettingsResponse)
async def get_control_panel_settings(
    project_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    await _ensure_project_owner(db, project_id, user_id)

    doc = await db.project_settings.find_one({"project_id": project_id, "user_id": user_id})
    if not doc:
        return ControlPanelSettingsResponse(project_id=project_id)

    return ControlPanelSettingsResponse(
        project_id=project_id,
        selected_template=doc.get("selected_template"),
        custom_style=doc.get("custom_style", {}) or {},
        resolved_style=doc.get("resolved_style", {}) or {},
        updated_at=str(doc.get("updated_at", "")),
    )


@router.put("/{project_id}", response_model=ControlPanelSettingsResponse)
async def upsert_control_panel_settings(
    project_id: str,
    body: ControlPanelSettingsUpsert,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    await _ensure_project_owner(db, project_id, user_id)

    now = datetime.now(timezone.utc)
    custom_style = body.custom_style.model_dump(exclude_none=True)
    resolved_style = body.resolved_style.model_dump(exclude_none=True)

    await db.project_settings.update_one(
        {"project_id": project_id, "user_id": user_id},
        {
            "$set": {
                "project_id": project_id,
                "user_id": user_id,
                "selected_template": body.selected_template,
                "custom_style": custom_style,
                "resolved_style": resolved_style,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    return ControlPanelSettingsResponse(
        project_id=project_id,
        selected_template=body.selected_template,
        custom_style=custom_style,
        resolved_style=resolved_style,
        updated_at=str(now),
    )
