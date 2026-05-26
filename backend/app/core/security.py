"""Firebase token verification and authorization dependencies."""
import base64
import json
import time

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from typing import Any, Callable, Dict, Optional
import logging

from app.core.config import settings
from app.db.database import format_database_error, get_database, is_database_error
from app.models.user import PLAN_HIERARCHY

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

PLAN_BASE_CREDITS = {
    "free": 60,
    "creator": 300,
    "studio": 1500,
}


def _decode_jwt_section(token: str, section_index: int) -> Dict[str, Any]:
    parts = token.split(".")
    if len(parts) <= section_index:
        return {}
    try:
        raw = parts[section_index]
        padded = raw + ("=" * (-len(raw) % 4))
        decoded = base64.urlsafe_b64decode(padded.encode("utf-8"))
        parsed = json.loads(decoded.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _token_diagnostics(token: str) -> Dict[str, Any]:
    header = _decode_jwt_section(token, 0)
    payload = _decode_jwt_section(token, 1)
    firebase_payload = payload.get("firebase") if isinstance(payload.get("firebase"), dict) else {}
    return {
        "length": len(token),
        "segments": len(token.split(".")),
        "header_alg": header.get("alg"),
        "header_kid_present": bool(header.get("kid")),
        "aud": payload.get("aud"),
        "iss": payload.get("iss"),
        "exp_delta_sec": int(payload["exp"] - time.time()) if isinstance(payload.get("exp"), (int, float)) else None,
        "sign_in_provider": firebase_payload.get("sign_in_provider"),
    }


def _log_token_verification_failure(reason: str, token: str, error: Exception) -> None:
    logger.warning(
        "Firebase ID token rejected: %s",
        json.dumps(
            {
                "reason": reason,
                "error_type": error.__class__.__name__,
                "error_message": str(error)[:300],
                "token": _token_diagnostics(token),
            },
            default=str,
        ),
    )


def _invalid_token_detail(error: Exception) -> str:
    message = str(error).lower()
    if "token used too early" in message or "clock is set correctly" in message:
        return "Server clock is out of sync. Sync the server time and retry sign-in."
    return "Authentication token could not be verified. Please refresh and retry."


def _firebase_clock_skew_seconds() -> int:
    try:
        value = int(settings.firebase_auth_clock_skew_seconds)
    except Exception:
        value = 60
    return max(0, min(value, 60))


def _verify_firebase_id_token(token: str) -> Dict[str, Any]:
    return auth.verify_id_token(
        token,
        check_revoked=False,
        clock_skew_seconds=_firebase_clock_skew_seconds(),
    )


def _raise_auth_service_unavailable(reason: str, token: str, error: Exception) -> None:
    """Convert Firebase Admin infrastructure failures into a retryable service error.

    Invalid, expired, and revoked tokens are handled by their typed exceptions above.
    The broad Firebase Admin exception path is usually certificate/network/config
    availability, so returning 401 makes the frontend treat a valid browser session
    as logged out. Surface it as 503 instead.
    """
    _log_token_verification_failure(reason, token, error)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Authentication services are temporarily unavailable. Please retry in a moment.",
    ) from error


def _normalize_legacy_credits(user: Dict[str, Any]) -> tuple[int, bool]:
    """Normalize legacy second-based balances to credit units."""
    raw_credits = user.get("credits_remaining", 0)
    try:
        credits = int(raw_credits or 0)
    except Exception:
        credits = 0
    if credits < 0:
        credits = 0

    if user.get("credits_unit") == "credits":
        return credits, False

    plan = str(user.get("plan", "free") or "free")
    expected = PLAN_BASE_CREDITS.get(plan)
    if expected is None:
        # Enterprise/custom plans can exceed standard ranges.
        return credits, False

    if credits > expected * 2:
        return max(0, int(round(credits / 60))), True
    return credits, False


def _raise_auth_data_unavailable(exc: Exception) -> None:
    """Convert database driver failures into a controlled auth dependency error."""
    if not is_database_error(exc):
        raise exc

    logger.error("User authorization data unavailable: %s", format_database_error(exc))
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Subtitlepro data services are temporarily unavailable. Please retry in a moment.",
    ) from exc


# ---------------------------------------------------------------------------
# Layer 1: Token verification (lightweight, no DB call)
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """Verify Firebase ID token and return decoded payload.

    This is the lightest auth check — it only validates the JWT.
    Returns dict with: uid, email, name, picture, email_verified

    check_revoked=False: skips the live network call to Firebase's revocation
    endpoint on every request. Revoked tokens will still fail on next login
    when they naturally expire. This eliminates spurious 401s caused by slow
    or restricted Firebase revocation endpoint responses.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )

    token = credentials.credentials

    try:
        decoded = _verify_firebase_id_token(token)
    except auth.ExpiredIdTokenError as e:
        _log_token_verification_failure("expired_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except auth.RevokedIdTokenError as e:
        _log_token_verification_failure("revoked_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
        )
    except auth.InvalidIdTokenError as e:
        _log_token_verification_failure("invalid_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_invalid_token_detail(e),
        )
    except Exception as e:
        _raise_auth_service_unavailable("verification_error", token, e)

    return {
        "uid": decoded.get("uid"),
        "email": decoded.get("email"),
        "name": decoded.get("name", ""),
        "picture": decoded.get("picture", ""),
        "email_verified": decoded.get("email_verified", False),
    }


async def get_current_user_from_request(request: Request) -> Dict[str, Any]:
    """Verify Firebase ID token from Authorization header or token query param."""
    auth_header = request.headers.get("authorization", "")
    scheme, _, value = auth_header.partition(" ")
    token = value if scheme.lower() == "bearer" and value else request.query_params.get("token", "")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )

    try:
        decoded = _verify_firebase_id_token(token)
    except auth.ExpiredIdTokenError as e:
        _log_token_verification_failure("expired_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
        )
    except auth.RevokedIdTokenError as e:
        _log_token_verification_failure("revoked_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked. Please sign in again.",
        )
    except auth.InvalidIdTokenError as e:
        _log_token_verification_failure("invalid_id_token", token, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_invalid_token_detail(e),
        )
    except Exception as e:
        _raise_auth_service_unavailable("verification_error", token, e)

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

    try:
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
                "credits_unit": "credits",
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

        normalized_credits, converted = _normalize_legacy_credits(user)
        if converted:
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"credits_remaining": normalized_credits, "credits_unit": "credits"}},
            )
            user["credits_remaining"] = normalized_credits
            user["credits_unit"] = "credits"

        # Sync email_verified flag from Firebase into MongoDB
        if not user.get("email_verified"):
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"email_verified": True}},
            )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_auth_data_unavailable(exc)

    # Check active status after data access succeeds.
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
        )

    return user


async def get_current_active_user_from_request(
    request: Request,
    db=Depends(get_database),
) -> Dict[str, Any]:
    """Fetch an active MongoDB user after header or query-token auth."""
    current_user = await get_current_user_from_request(request)
    if not current_user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify your email before proceeding.",
        )
    uid = current_user["uid"]

    try:
        user = await db.users.find_one({"uid": uid})

        if not user:
            from datetime import datetime, timezone

            user = {
                "uid": uid,
                "email": current_user["email"],
                "name": current_user.get("name", ""),
                "picture": current_user.get("picture", ""),
                "plan": "free",
                "credits_remaining": 60,
                "credits_unit": "credits",
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

        normalized_credits, converted = _normalize_legacy_credits(user)
        if converted:
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"credits_remaining": normalized_credits, "credits_unit": "credits"}},
            )
            user["credits_remaining"] = normalized_credits
            user["credits_unit"] = "credits"

        if not user.get("email_verified"):
            await db.users.update_one(
                {"uid": uid},
                {"$set": {"email_verified": True}},
            )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_auth_data_unavailable(exc)

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact support.",
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
        credits = int(user.get("credits_remaining", 0) or 0)
        if credits < int(min_credits):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. You have {credits} credits remaining. "
                       f"Please upgrade your plan or purchase additional credits.",
            )
        return user

    return _check_credits
