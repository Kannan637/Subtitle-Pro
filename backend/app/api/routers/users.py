"""User profile and onboarding endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone

from app.core.security import get_current_user
from app.db.database import get_database

router = APIRouter()


class OnboardingData(BaseModel):
    """Schema for onboarding form submission."""
    role: str = Field(..., description="User's role/profession")
    heard_from: str = Field(..., description="How user heard about us")
    team_size: str = Field(..., description="Team size")
    use_case: str = Field(..., description="Primary use case")


@router.get("/me")
async def get_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get the current user's profile. Creates a new record if first-time login.

    Returns `is_new_user: true` if the user was just created (for onboarding flow).
    """
    db = get_database()
    uid = current_user["uid"]
    email = current_user["email"]
    name = current_user.get("name", "")
    picture = current_user.get("picture", "")

    if not uid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user token payload",
        )

    # Find existing user
    user = await db.users.find_one({"uid": uid})

    if user:
        return {
            "uid": user["uid"],
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture", ""),
            "plan": user.get("plan", "free"),
            "credits_remaining": user.get("credits_remaining", 60),
            "onboarding_completed": user.get("onboarding_completed", False),
            "is_new_user": False,
        }

    # Create new user
    new_user = {
        "uid": uid,
        "email": email,
        "name": name,
        "picture": picture,
        "plan": "free",
        "credits_remaining": 60,
        "onboarding_completed": False,
        "onboarding_data": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    await db.users.insert_one(new_user)

    return {
        "uid": uid,
        "email": email,
        "name": name,
        "picture": picture,
        "plan": "free",
        "credits_remaining": 60,
        "onboarding_completed": False,
        "is_new_user": True,
    }


@router.put("/me/onboarding")
async def complete_onboarding(
    data: OnboardingData,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Save onboarding form data and mark onboarding as completed."""
    db = get_database()
    uid = current_user["uid"]

    result = await db.users.update_one(
        {"uid": uid},
        {
            "$set": {
                "onboarding_completed": True,
                "onboarding_data": data.model_dump(),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {"status": "ok", "message": "Onboarding completed"}
