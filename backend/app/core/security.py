"""Firebase token verification and authorization dependencies."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from typing import Any, Callable, Dict
import logging

from app.db.database import get_database
from app.models.user import PLAN_HIERARCHY

logger = logging.getLogger(__name__)

security = HTTPBearer()


# ---------------------------------------------------------------------------
# Layer 1: Token verification (lightweight, no DB call)
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    """Verify Firebase ID token and return decoded payload.

    This is the lightest auth check — it only validates the JWT.
    Returns dict with: uid, email, name, picture, email_verified
    """
    token = credentials.credentials

    try:
        decoded = auth.verify_id_token(token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed.",
        )

    return {
        "uid": decoded.get("uid"),
        "email": decoded.get("email"),
        "name": decoded.get("name", ""),
        "picture": decoded.get("picture", ""),
        "email_verified": decoded.get("email_verified", False),
    }


# ---------------------------------------------------------------------------
# Layer 2: Email-verified user
# ---------------------------------------------------------------------------
async def get_verified_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Ensure the Firebase user has a verified email address.

    Use this dependency on routes that require confirmed identity
    (e.g., uploading media, creating projects).
    """
    if not current_user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify your email before proceeding.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Layer 3: Active user with DB record
# ---------------------------------------------------------------------------
async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_verified_user),
    db=Depends(get_database),
) -> Dict[str, Any]:
    """Fetch the user from MongoDB and verify they are active.

    This dependency:
    1. Requires a verified email (via get_verified_user).
    2. Looks up the user in MongoDB.
    3. Creates a new DB record on first login (auto-provisioning).
    4. Checks `is_active` flag (allows banning/suspending users).

    Returns the full MongoDB user document as a dict.
    """
    uid = current_user["uid"]

    user = await db.users.find_one({"uid": uid})

    if not user:
        # Auto-provision on first authenticated request
        from datetime import datetime, timezone

        user = {
            "uid": uid,
            "email": current_user["email"],
            "name": current_user.get("name", ""),
            "picture": current_user.get("picture", ""),
            "plan": "free",
            "credits_remaining": 60,
            "is_active": True,
            "email_verified": True,
            "onboarding_completed": False,
            "onboarding_data": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
        user["is_new_user"] = True
    else:
        user["is_new_user"] = False

    # Check active status
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )

    # Sync email_verified flag from Firebase into MongoDB
    if not user.get("email_verified"):
        await db.users.update_one(
            {"uid": uid},
            {"$set": {"email_verified": True}},
        )

    return user


# ---------------------------------------------------------------------------
# Layer 4: Plan-based access control (RBAC)
# ---------------------------------------------------------------------------
def require_plan(min_plan: str) -> Callable:
    """Dependency factory that restricts access based on subscription tier.

    Usage::

        @router.post("/export/burn-in")
        async def burn_in_subtitles(
            user: dict = Depends(require_plan("studio")),
        ):
            ...

    Plan hierarchy: free < creator < studio < enterprise
    """
    min_level = PLAN_HIERARCHY.get(min_plan, 0)

    async def _check_plan(
        user: Dict[str, Any] = Depends(get_current_active_user),
    ) -> Dict[str, Any]:
        user_plan = user.get("plan", "free")
        user_level = PLAN_HIERARCHY.get(user_plan, 0)

        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires the {min_plan.capitalize()} plan or higher. "
                       f"You are currently on the {user_plan.capitalize()} plan.",
            )
        return user

    return _check_plan


# ---------------------------------------------------------------------------
# Layer 5: Credit check
# ---------------------------------------------------------------------------
def require_credits(min_credits: int = 1) -> Callable:
    """Dependency factory that ensures the user has sufficient credits.

    Usage::

        @router.post("/jobs")
        async def create_job(
            user: dict = Depends(require_credits(5)),
        ):
            ...
    """
    async def _check_credits(
        user: Dict[str, Any] = Depends(get_current_active_user),
    ) -> Dict[str, Any]:
        credits = user.get("credits_remaining", 0)
        if credits < min_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. You have {credits} min remaining. "
                       f"Please upgrade your plan or purchase additional credits.",
            )
        return user

    return _check_credits
