"""Social media scheduler routes."""
from __future__ import annotations

import base64
import asyncio
import hashlib
import json
import logging
import mimetypes
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bson import ObjectId
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pymongo import ReturnDocument
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import get_current_active_user
from app.db.database import get_database

router = APIRouter(prefix="/social-scheduler", tags=["social-scheduler"])
logger = logging.getLogger(__name__)

SchedulerStatus = Literal["draft", "ready", "scheduled", "published"]

SUPPORTED_PLATFORMS: list[dict[str, Any]] = [
    {
        "id": "youtube_shorts",
        "name": "YouTube Shorts",
        "channel_type": "short_video",
        "character_limit": 100,
        "supports_video": True,
        "recommended_ratio": "9:16",
    },
    {
        "id": "instagram_reels",
        "name": "Instagram Reels",
        "channel_type": "short_video",
        "character_limit": 2200,
        "supports_video": True,
        "recommended_ratio": "9:16",
    },
    {
        "id": "tiktok",
        "name": "TikTok",
        "channel_type": "short_video",
        "character_limit": 2200,
        "supports_video": True,
        "recommended_ratio": "9:16",
    },
    {
        "id": "facebook_reels",
        "name": "Facebook Reels",
        "channel_type": "short_video",
        "character_limit": 2200,
        "supports_video": True,
        "recommended_ratio": "9:16",
    },
    {
        "id": "linkedin",
        "name": "LinkedIn",
        "channel_type": "professional",
        "character_limit": 3000,
        "supports_video": True,
        "recommended_ratio": "16:9",
    },
    {
        "id": "x",
        "name": "X",
        "channel_type": "social_post",
        "character_limit": 280,
        "supports_video": True,
        "recommended_ratio": "16:9",
    },
    {
        "id": "threads",
        "name": "Threads",
        "channel_type": "social_post",
        "character_limit": 500,
        "supports_video": True,
        "recommended_ratio": "9:16",
    },
]

SUPPORTED_PLATFORM_IDS = {platform["id"] for platform in SUPPORTED_PLATFORMS}
SUPPORTED_STATUSES = {"draft", "ready", "scheduled", "published"}
OAUTH_STATE_TTL_MINUTES = 10

OAUTH_PROVIDERS: dict[str, dict[str, Any]] = {
    "youtube_shorts": {
        "credential_prefix": "youtube",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": [
            "https://www.googleapis.com/auth/youtube.upload",
            "https://www.googleapis.com/auth/youtube.force-ssl",
        ],
        "scope_separator": " ",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "post",
        "extra_auth_params": {
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
        },
    },
    "instagram_reels": {
        "credential_prefix": "meta",
        "auth_url": "__meta_dialog__",
        "token_url": "__meta_token__",
        "scopes": ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
        "scope_separator": ",",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "get",
    },
    "facebook_reels": {
        "credential_prefix": "meta",
        "auth_url": "__meta_dialog__",
        "token_url": "__meta_token__",
        "scopes": ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "publish_video"],
        "scope_separator": ",",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "get",
    },
    "tiktok": {
        "credential_prefix": "tiktok",
        "auth_url": "https://www.tiktok.com/v2/auth/authorize/",
        "token_url": "https://open.tiktokapis.com/v2/oauth/token/",
        "scopes": ["user.info.basic", "video.upload", "video.publish"],
        "scope_separator": ",",
        "client_param": "client_key",
        "secret_param": "client_secret",
        "token_method": "post",
    },
    "linkedin": {
        "credential_prefix": "linkedin",
        "auth_url": "https://www.linkedin.com/oauth/v2/authorization",
        "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
        "scopes": ["openid", "profile", "email", "w_member_social"],
        "scope_separator": " ",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "post",
    },
    "x": {
        "credential_prefix": "x",
        "auth_url": "https://x.com/i/oauth2/authorize",
        "token_url": "https://api.x.com/2/oauth2/token",
        "scopes": ["tweet.read", "tweet.write", "users.read", "offline.access"],
        "scope_separator": " ",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "post",
        "use_pkce": True,
        "token_auth": "basic_optional",
    },
    "threads": {
        "credential_prefix": "threads",
        "auth_url": "https://threads.net/oauth/authorize",
        "token_url": "https://graph.threads.net/oauth/access_token",
        "scopes": ["threads_basic", "threads_content_publish"],
        "scope_separator": ",",
        "client_param": "client_id",
        "secret_param": "client_secret",
        "token_method": "post",
    },
}


class SchedulerPostCreate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    caption: str = Field(default="", max_length=4000)
    platforms: list[str] = Field(default_factory=list, max_length=8)
    status: SchedulerStatus = "draft"
    scheduled_at: str | None = Field(default=None, max_length=80)
    timezone: str = Field(default="Asia/Calcutta", max_length=80)
    project_id: str | None = Field(default=None, max_length=80)
    short_id: str | None = Field(default=None, max_length=120)
    asset_url: str | None = Field(default=None, max_length=2048)
    campaign: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=20)


class SchedulerPostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=140)
    caption: str | None = Field(default=None, max_length=4000)
    platforms: list[str] | None = Field(default=None, max_length=8)
    status: SchedulerStatus | None = None
    scheduled_at: str | None = Field(default=None, max_length=80)
    timezone: str | None = Field(default=None, max_length=80)
    asset_url: str | None = Field(default=None, max_length=2048)
    campaign: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = Field(default=None, max_length=20)


def _serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    for key in ("created_at", "updated_at"):
        value = item.get(key)
        if isinstance(value, datetime):
            item[key] = value.isoformat()
    return item


def _validate_platforms(platforms: list[str]) -> list[str]:
    clean = []
    for platform in platforms:
        item = str(platform or "").strip()
        if not item:
            continue
        if item not in SUPPORTED_PLATFORM_IDS:
            raise HTTPException(status_code=400, detail=f"Unsupported social platform: {item}")
        if item not in clean:
            clean.append(item)
    return clean


def _validate_status(value: str) -> str:
    if value not in SUPPORTED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unsupported scheduler status: {value}")
    return value


def _object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scheduler item ID")


def _provider_config(platform_id: str) -> dict[str, Any]:
    provider = OAUTH_PROVIDERS.get(platform_id)
    if not provider:
        raise HTTPException(status_code=400, detail="OAuth is not available for this platform yet")

    config = dict(provider)
    graph_version = (settings.meta_graph_version or "v22.0").strip().lstrip("/")
    if config.get("auth_url") == "__meta_dialog__":
        config["auth_url"] = f"https://www.facebook.com/{graph_version}/dialog/oauth"
    if config.get("token_url") == "__meta_token__":
        config["token_url"] = f"https://graph.facebook.com/{graph_version}/oauth/access_token"
    return config


def _provider_credentials(provider: dict[str, Any]) -> tuple[str, str]:
    prefix = str(provider.get("credential_prefix") or "")
    if prefix == "youtube":
        return settings.youtube_oauth_client_id.strip(), settings.youtube_oauth_client_secret.strip()
    if prefix == "meta":
        return settings.meta_oauth_client_id.strip(), settings.meta_oauth_client_secret.strip()
    if prefix == "tiktok":
        return settings.tiktok_oauth_client_key.strip(), settings.tiktok_oauth_client_secret.strip()
    if prefix == "linkedin":
        return settings.linkedin_oauth_client_id.strip(), settings.linkedin_oauth_client_secret.strip()
    if prefix == "x":
        return settings.x_oauth_client_id.strip(), settings.x_oauth_client_secret.strip()
    if prefix == "threads":
        return settings.threads_oauth_client_id.strip(), settings.threads_oauth_client_secret.strip()
    return "", ""


def _public_api_base(request: Request) -> str:
    configured = (settings.social_oauth_api_base_url or "").strip().rstrip("/")
    if configured:
        return configured
    return f"{str(request.base_url).rstrip('/')}{settings.api_v1_str}"


def _oauth_redirect_uri(request: Request, platform_id: str) -> str:
    return f"{_public_api_base(request)}/social-scheduler/oauth/{platform_id}/callback"


def _frontend_scheduler_url(platform_id: str, result: str, message: str = "") -> str:
    base = (settings.frontend_app_url or "/").strip().rstrip("/")
    if not base:
        base = "/"
    path = "/dashboard/social-scheduler"
    query = urlencode({
        "oauth": result,
        "platform": platform_id,
        **({"message": message} if message else {}),
    })
    if base == "/":
        return f"{path}?{query}"
    return f"{base}{path}?{query}"


def _code_verifier() -> str:
    return secrets.token_urlsafe(64)[:96]


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def _fernet() -> Fernet:
    secret = (settings.social_oauth_token_secret or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure social token storage is not configured.",
        )
    try:
        return Fernet(secret.encode("utf-8"))
    except (ValueError, InvalidToken) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure social token storage is misconfigured.",
        ) from exc


def _encrypt_token_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    return _fernet().encrypt(raw).decode("utf-8")


def _decrypt_token_payload(value: str) -> dict[str, Any]:
    if not value:
        return {}
    try:
        raw = _fernet().decrypt(value.encode("utf-8"))
        payload = json.loads(raw.decode("utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def _token_expiry(token_payload: dict[str, Any]) -> datetime | None:
    try:
        expires_in = int(token_payload.get("expires_in") or 0)
    except Exception:
        expires_in = 0
    if expires_in <= 0:
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=expires_in)


def _scope_string(provider: dict[str, Any]) -> str:
    separator = str(provider.get("scope_separator") or " ")
    return separator.join(str(scope) for scope in provider.get("scopes", []))


def _parse_scheduled_at(value: str | None, timezone_name: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        try:
            local_tz = ZoneInfo(str(timezone_name or "UTC"))
        except ZoneInfoNotFoundError:
            local_tz = timezone.utc
        parsed = parsed.replace(tzinfo=local_tz)
    return parsed.astimezone(timezone.utc)


def _scheduled_for_utc(body: dict[str, Any]) -> datetime | None:
    return _parse_scheduled_at(body.get("scheduled_at"), body.get("timezone"))


def _safe_publish_privacy_status() -> str:
    value = str(settings.social_scheduler_publish_privacy_status or "public").strip().lower()
    return value if value in {"public", "private", "unlisted"} else "public"


def _authorization_url(
    provider: dict[str, Any],
    *,
    client_id: str,
    state: str,
    redirect_uri: str,
    code_challenge: str | None,
) -> str:
    params = {
        str(provider.get("client_param") or "client_id"): client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": _scope_string(provider),
        "state": state,
    }
    params.update(provider.get("extra_auth_params") or {})
    if code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = "S256"
    return f"{provider['auth_url']}?{urlencode(params)}"


async def _exchange_oauth_code(
    provider: dict[str, Any],
    *,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    code_verifier: str | None,
) -> dict[str, Any]:
    client_param = str(provider.get("client_param") or "client_id")
    secret_param = str(provider.get("secret_param") or "client_secret")
    data: dict[str, Any] = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        client_param: client_id,
    }
    if client_secret:
        data[secret_param] = client_secret
    if code_verifier:
        data["code_verifier"] = code_verifier

    headers: dict[str, str] = {"Accept": "application/json"}
    if provider.get("token_auth") == "basic_optional" and client_secret:
        raw = f"{client_id}:{client_secret}".encode("utf-8")
        headers["Authorization"] = f"Basic {base64.b64encode(raw).decode('utf-8')}"
        data.pop(secret_param, None)

    async with httpx.AsyncClient(timeout=30.0) as client:
        if provider.get("token_method") == "get":
            response = await client.get(provider["token_url"], params=data, headers=headers)
        else:
            response = await client.post(provider["token_url"], data=data, headers=headers)

    try:
        payload = response.json()
    except Exception:
        payload = {"error": response.text[:500]}

    if response.status_code >= 400 or not isinstance(payload, dict) or not payload.get("access_token"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Social platform authorization failed. Please retry the connection.",
        )
    return payload


async def _refresh_access_token_if_needed(
    db,
    connection: dict[str, Any],
    provider: dict[str, Any],
) -> dict[str, Any]:
    payload = _decrypt_token_payload(str(connection.get("oauth_token") or ""))
    access_token = str(payload.get("access_token") or "")
    expires_at = connection.get("token_expires_at")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if access_token and isinstance(expires_at, datetime) and expires_at > datetime.now(timezone.utc) + timedelta(minutes=2):
        return payload

    refresh_token = str(payload.get("refresh_token") or "")
    if not refresh_token:
        if access_token:
            return payload
        raise RuntimeError("Connected account needs to be reconnected.")

    client_id, client_secret = _provider_credentials(provider)
    client_param = str(provider.get("client_param") or "client_id")
    secret_param = str(provider.get("secret_param") or "client_secret")
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        client_param: client_id,
        secret_param: client_secret,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(provider["token_url"], data=data, headers={"Accept": "application/json"})

    try:
        refreshed = response.json()
    except Exception:
        refreshed = {"error": response.text[:500]}

    if response.status_code >= 400 or not isinstance(refreshed, dict) or not refreshed.get("access_token"):
        raise RuntimeError("Connected account authorization expired. Reconnect the channel.")

    merged = {**payload, **refreshed, "refresh_token": refreshed.get("refresh_token") or refresh_token}
    token_expires_at = _token_expiry(merged)
    await db.social_connections.update_one(
        {"_id": connection["_id"]},
        {
            "$set": {
                "oauth_token": _encrypt_token_payload(merged),
                "token_expires_at": token_expires_at,
                "updated_at": datetime.now(timezone.utc),
                "last_checked_at": datetime.now(timezone.utc).isoformat(),
                "last_error": None,
            }
        },
    )
    return merged


async def _resolve_post_asset_path(post: dict[str, Any], db) -> str:
    candidates = [
        str(post.get("asset_url") or ""),
    ]
    project_id = str(post.get("project_id") or "")
    if project_id:
        media = await db.media_files.find_one({"project_id": project_id})
        if media:
            candidates.extend([
                str(media.get("local_path") or ""),
                str(media.get("proxy_path") or ""),
            ])
    for candidate in candidates:
        if candidate and os.path.exists(candidate) and os.path.isfile(candidate):
            return candidate
    raise RuntimeError("Video asset is missing. Upload a video before publishing.")


async def _file_chunker(path: str, chunk_size: int = 1024 * 1024):
    with open(path, "rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            yield chunk


async def _upload_youtube_video(
    *,
    access_token: str,
    file_path: str,
    title: str,
    description: str,
    tags: list[str],
) -> dict[str, Any]:
    content_type = mimetypes.guess_type(file_path)[0] or "video/mp4"
    file_size = os.path.getsize(file_path)
    metadata = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": tags[:30],
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": _safe_publish_privacy_status(),
            "selfDeclaredMadeForKids": False,
        },
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": str(file_size),
        "X-Upload-Content-Type": content_type,
    }
    upload_url = "https://www.googleapis.com/upload/youtube/v3/videos"
    params = {"uploadType": "resumable", "part": "snippet,status"}
    async with httpx.AsyncClient(timeout=None) as client:
        init_response = await client.post(upload_url, params=params, headers=headers, json=metadata)
        if init_response.status_code >= 400:
            raise RuntimeError("YouTube upload session could not be created.")
        session_url = init_response.headers.get("Location")
        if not session_url:
            raise RuntimeError("YouTube upload session did not return an upload URL.")

        upload_response = await client.put(
            session_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": content_type,
                "Content-Length": str(file_size),
            },
            content=_file_chunker(file_path),
        )

    try:
        payload = upload_response.json()
    except Exception:
        payload = {"raw": upload_response.text[:500]}

    if upload_response.status_code not in {200, 201} or not isinstance(payload, dict) or not payload.get("id"):
        raise RuntimeError("YouTube rejected the video upload. Check channel authorization and quota.")

    return {
        "platform": "youtube_shorts",
        "status": "published",
        "provider_id": payload.get("id"),
        "url": f"https://www.youtube.com/shorts/{payload.get('id')}",
        "published_at": datetime.now(timezone.utc).isoformat(),
    }


async def _publish_to_platform(post: dict[str, Any], platform_id: str, db) -> dict[str, Any]:
    if platform_id != "youtube_shorts":
        return {
            "platform": platform_id,
            "status": "skipped",
            "error": "Automated publishing for this channel is not enabled yet.",
            "published_at": datetime.now(timezone.utc).isoformat(),
        }

    connection = await db.social_connections.find_one({
        "user_id": post.get("user_id"),
        "platform_id": platform_id,
        "connected": True,
    })
    if not connection:
        raise RuntimeError("YouTube Shorts account is not connected.")

    provider = _provider_config(platform_id)
    token_payload = await _refresh_access_token_if_needed(db, connection, provider)
    access_token = str(token_payload.get("access_token") or "")
    if not access_token:
        raise RuntimeError("YouTube Shorts authorization is missing. Reconnect the channel.")

    file_path = await _resolve_post_asset_path(post, db)
    return await _upload_youtube_video(
        access_token=access_token,
        file_path=file_path,
        title=str(post.get("title") or "Subtitlepro clip"),
        description=str(post.get("caption") or ""),
        tags=[str(tag) for tag in post.get("tags", []) if str(tag).strip()],
    )


async def publish_scheduler_post(post: dict[str, Any], db) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    platforms = _validate_platforms([str(item) for item in post.get("platforms", [])])
    if not platforms:
        raise RuntimeError("No publishing channels selected.")

    results: list[dict[str, Any]] = []
    for platform_id in platforms:
        try:
            result = await _publish_to_platform(post, platform_id, db)
            results.append(result)
        except Exception as exc:
            results.append({
                "platform": platform_id,
                "status": "error",
                "error": str(exc)[:300],
                "published_at": now.isoformat(),
            })

    success_count = sum(1 for item in results if item.get("status") == "published")
    error_count = sum(1 for item in results if item.get("status") == "error")
    skipped_count = sum(1 for item in results if item.get("status") == "skipped")
    final_status = "published" if success_count > 0 else "ready"
    summary = {
        "success_count": success_count,
        "error_count": error_count,
        "skipped_count": skipped_count,
        "attempted_at": now.isoformat(),
    }
    await db.social_scheduler_posts.update_one(
        {"_id": post["_id"]},
        {
            "$set": {
                "status": final_status,
                "publish_status": "complete" if success_count else "error",
                "publish_results": results,
                "publish_summary": summary,
                "published_at": now if success_count else None,
                "last_error": None if success_count else "; ".join(str(item.get("error")) for item in results if item.get("error"))[:500],
                "updated_at": now,
            },
            "$unset": {"publish_lock_until": ""},
        },
    )
    return {"post_id": str(post["_id"]), **summary, "results": results, "status": final_status}


@router.get("/platforms")
async def list_social_platforms(
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    connection_rows = await db.social_connections.find({"user_id": user_id}).to_list(length=100)
    connections = {str(row.get("platform_id", "")): row for row in connection_rows}

    platforms: list[dict[str, Any]] = []
    for platform in SUPPORTED_PLATFORMS:
        connection = connections.get(platform["id"], {})
        provider = OAUTH_PROVIDERS.get(platform["id"])
        client_id, client_secret = _provider_credentials(_provider_config(platform["id"])) if provider else ("", "")
        platforms.append({
            **platform,
            "status": str(connection.get("status", "not_connected")),
            "connected": bool(connection.get("connected", False)),
            "oauth_configured": bool(client_id and client_secret),
            "account_name": connection.get("account_name"),
            "last_checked_at": connection.get("last_checked_at"),
        })
    return {"platforms": platforms}


@router.get("/oauth/{platform_id}/start")
async def start_social_oauth(
    platform_id: str,
    request: Request,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    if platform_id not in SUPPORTED_PLATFORM_IDS:
        raise HTTPException(status_code=400, detail="Unsupported social platform")

    provider = _provider_config(platform_id)
    client_id, client_secret = _provider_credentials(provider)
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="OAuth is not configured for this social channel.")
    _fernet()

    state = secrets.token_urlsafe(32)
    redirect_uri = _oauth_redirect_uri(request, platform_id)
    verifier = _code_verifier() if provider.get("use_pkce") else None
    challenge = _code_challenge(verifier) if verifier else None
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=OAUTH_STATE_TTL_MINUTES)

    await db.social_oauth_states.delete_many({"expires_at": {"$lt": now}})
    await db.social_oauth_states.insert_one({
        "state": state,
        "user_id": user_id,
        "platform_id": platform_id,
        "redirect_uri": redirect_uri,
        "code_verifier": verifier,
        "used": False,
        "created_at": now,
        "expires_at": expires_at,
    })

    return {
        "authorization_url": _authorization_url(
            provider,
            client_id=client_id,
            state=state,
            redirect_uri=redirect_uri,
            code_challenge=challenge,
        ),
        "platform_id": platform_id,
        "redirect_uri": redirect_uri,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/oauth/{platform_id}/callback")
async def social_oauth_callback(
    platform_id: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    db=Depends(get_database),
):
    if platform_id not in SUPPORTED_PLATFORM_IDS:
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", "Unsupported social platform."))
    if error:
        message = error_description or error
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", str(message)[:180]))
    if not code or not state:
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", "Missing authorization code."))

    now = datetime.now(timezone.utc)
    state_doc = await db.social_oauth_states.find_one({
        "state": state,
        "platform_id": platform_id,
        "used": False,
    })
    if not state_doc:
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", "Authorization session expired."))
    expires_at = state_doc.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if isinstance(expires_at, datetime) and expires_at < now:
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", "Authorization session expired."))

    await db.social_oauth_states.update_one(
        {"_id": state_doc["_id"]},
        {"$set": {"used": True, "used_at": now}},
    )

    provider = _provider_config(platform_id)
    client_id, client_secret = _provider_credentials(provider)
    if not client_id or not client_secret:
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", "OAuth is not configured for this channel."))

    try:
        token_payload = await _exchange_oauth_code(
            provider,
            client_id=client_id,
            client_secret=client_secret,
            code=code,
            redirect_uri=str(state_doc.get("redirect_uri") or ""),
            code_verifier=state_doc.get("code_verifier"),
        )
        encrypted_token = _encrypt_token_payload(token_payload)
    except HTTPException as exc:
        message = str(exc.detail or "Social authorization failed.")
        await db.social_connections.update_one(
            {"user_id": state_doc["user_id"], "platform_id": platform_id},
            {
                "$set": {
                    "status": "error",
                    "connected": False,
                    "last_error": message[:300],
                    "updated_at": now,
                    "last_checked_at": now.isoformat(),
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        return RedirectResponse(_frontend_scheduler_url(platform_id, "error", message[:180]))

    token_expires_at = _token_expiry(token_payload)
    account_name = (
        token_payload.get("open_id")
        or token_payload.get("id")
        or token_payload.get("sub")
        or token_payload.get("user_id")
        or "Connected account"
    )
    await db.social_connections.update_one(
        {"user_id": state_doc["user_id"], "platform_id": platform_id},
        {
            "$set": {
                "user_id": state_doc["user_id"],
                "platform_id": platform_id,
                "status": "connected",
                "connected": True,
                "account_name": str(account_name),
                "oauth_token": encrypted_token,
                "token_encrypted": True,
                "token_expires_at": token_expires_at,
                "scopes": provider.get("scopes", []),
                "updated_at": now,
                "last_checked_at": now.isoformat(),
                "last_error": None,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return RedirectResponse(_frontend_scheduler_url(platform_id, "success"))


@router.post("/connections/{platform_id}")
async def prepare_social_connection(
    platform_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    if platform_id not in SUPPORTED_PLATFORM_IDS:
        raise HTTPException(status_code=400, detail="Unsupported social platform")

    now = datetime.now(timezone.utc)
    await db.social_connections.update_one(
        {"user_id": user_id, "platform_id": platform_id},
        {
            "$set": {
                "user_id": user_id,
                "platform_id": platform_id,
                "status": "setup_required",
                "connected": False,
                "updated_at": now,
                "last_checked_at": now.isoformat(),
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return {
        "platform_id": platform_id,
        "status": "setup_required",
        "connected": False,
        "message": "Platform connection setup is ready to configure.",
    }


@router.get("/posts")
async def list_scheduler_posts(
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    query: dict[str, Any] = {"user_id": user_id}
    if status_filter:
        query["status"] = _validate_status(status_filter)

    cursor = db.social_scheduler_posts.find(query).sort([("updated_at", -1), ("created_at", -1)]).limit(200)
    rows = await cursor.to_list(length=200)
    return {"items": [_serialize_doc(row) for row in rows]}


@router.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_scheduler_post(
    body: SchedulerPostCreate,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    now = datetime.now(timezone.utc)
    post = body.model_dump()
    post["platforms"] = _validate_platforms(post.get("platforms", []))
    post["status"] = _validate_status(str(post.get("status", "draft")))
    post["tags"] = [str(tag).strip() for tag in post.get("tags", []) if str(tag).strip()][:20]
    scheduled_for = _scheduled_for_utc(post)
    post.update({
        "user_id": user_id,
        "scheduled_for_utc": scheduled_for,
        "publish_status": "scheduled" if post["status"] == "scheduled" else "idle",
        "created_at": now,
        "updated_at": now,
        "publish_results": [],
    })

    result = await db.social_scheduler_posts.insert_one(post)
    created = await db.social_scheduler_posts.find_one({"_id": result.inserted_id, "user_id": user_id})
    return _serialize_doc(created)


@router.patch("/posts/{post_id}")
async def update_scheduler_post(
    post_id: str,
    body: SchedulerPostUpdate,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    patch = body.model_dump(exclude_unset=True)
    if "platforms" in patch and patch["platforms"] is not None:
        patch["platforms"] = _validate_platforms(patch["platforms"])
    if "status" in patch and patch["status"] is not None:
        patch["status"] = _validate_status(str(patch["status"]))
    if "tags" in patch and patch["tags"] is not None:
        patch["tags"] = [str(tag).strip() for tag in patch["tags"] if str(tag).strip()][:20]
    if not patch:
        raise HTTPException(status_code=400, detail="No scheduler changes supplied")

    if "scheduled_at" in patch or "timezone" in patch or "status" in patch:
        merged = {
            "scheduled_at": patch.get("scheduled_at", body.scheduled_at),
            "timezone": patch.get("timezone", body.timezone),
        }
        existing = await db.social_scheduler_posts.find_one({"_id": _object_id(post_id), "user_id": user_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Scheduler item not found")
        merged["scheduled_at"] = patch.get("scheduled_at", existing.get("scheduled_at"))
        merged["timezone"] = patch.get("timezone", existing.get("timezone"))
        patch["scheduled_for_utc"] = _scheduled_for_utc(merged)
        if patch.get("status") == "scheduled":
            patch["publish_status"] = "scheduled"

    patch["updated_at"] = datetime.now(timezone.utc)
    result = await db.social_scheduler_posts.find_one_and_update(
        {"_id": _object_id(post_id), "user_id": user_id},
        {"$set": patch},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Scheduler item not found")
    return _serialize_doc(result)


@router.post("/posts/{post_id}/publish")
async def publish_scheduler_post_now(
    post_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    now = datetime.now(timezone.utc)
    post = await db.social_scheduler_posts.find_one_and_update(
        {
            "_id": _object_id(post_id),
            "user_id": user_id,
            "$or": [
                {"publish_lock_until": {"$exists": False}},
                {"publish_lock_until": {"$lt": now}},
            ],
        },
        {
            "$set": {
                "publish_status": "processing",
                "publish_lock_until": now + timedelta(minutes=15),
                "last_publish_attempt_at": now,
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if not post:
        raise HTTPException(status_code=404, detail="Scheduler item not found or already publishing")

    try:
        return await publish_scheduler_post(post, db)
    except Exception as exc:
        await db.social_scheduler_posts.update_one(
            {"_id": post["_id"]},
            {
                "$set": {
                    "publish_status": "error",
                    "last_error": str(exc)[:500],
                    "updated_at": datetime.now(timezone.utc),
                },
                "$unset": {"publish_lock_until": ""},
            },
        )
        raise HTTPException(status_code=502, detail="Publishing failed. Check channel connection and video asset.") from exc


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduler_post(
    post_id: str,
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    result = await db.social_scheduler_posts.delete_one({"_id": _object_id(post_id), "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduler item not found")
    return None


async def _due_scheduled_posts(db, now: datetime) -> list[dict[str, Any]]:
    rows = await db.social_scheduler_posts.find({
        "status": "scheduled",
        "$or": [
            {"publish_lock_until": {"$exists": False}},
            {"publish_lock_until": {"$lt": now}},
        ],
    }).sort([("scheduled_for_utc", 1), ("created_at", 1)]).limit(max(1, settings.social_scheduler_batch_size * 4)).to_list(length=100)

    due: list[dict[str, Any]] = []
    for row in rows:
        scheduled_for = row.get("scheduled_for_utc")
        if isinstance(scheduled_for, datetime):
            if scheduled_for.tzinfo is None:
                scheduled_for = scheduled_for.replace(tzinfo=timezone.utc)
            if scheduled_for <= now:
                due.append(row)
        else:
            parsed = _scheduled_for_utc(row)
            if parsed and parsed <= now:
                due.append(row)
        if len(due) >= max(1, settings.social_scheduler_batch_size):
            break
    return due


async def process_due_social_posts(db) -> int:
    now = datetime.now(timezone.utc)
    due = await _due_scheduled_posts(db, now)
    processed = 0
    for row in due:
        locked = await db.social_scheduler_posts.find_one_and_update(
            {
                "_id": row["_id"],
                "status": "scheduled",
                "$or": [
                    {"publish_lock_until": {"$exists": False}},
                    {"publish_lock_until": {"$lt": now}},
                ],
            },
            {
                "$set": {
                    "publish_status": "processing",
                    "publish_lock_until": now + timedelta(minutes=15),
                    "last_publish_attempt_at": now,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not locked:
            continue
        try:
            await publish_scheduler_post(locked, db)
            processed += 1
        except Exception as exc:
            logger.exception("Scheduled social publish failed for post %s", locked.get("_id"))
            await db.social_scheduler_posts.update_one(
                {"_id": locked["_id"]},
                {
                    "$set": {
                        "publish_status": "error",
                        "last_error": str(exc)[:500],
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$unset": {"publish_lock_until": ""},
                },
            )
    return processed


async def social_scheduler_loop(db, stop_event: asyncio.Event) -> None:
    if not settings.social_scheduler_enabled:
        logger.info("Social scheduler background publisher is disabled.")
        return
    poll_seconds = max(5, int(settings.social_scheduler_poll_seconds or 30))
    logger.info("Social scheduler background publisher started with %ss polling.", poll_seconds)
    while not stop_event.is_set():
        try:
            count = await process_due_social_posts(db)
            if count:
                logger.info("Published %s due social scheduler post(s).", count)
        except Exception:
            logger.exception("Social scheduler loop failed.")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_seconds)
        except asyncio.TimeoutError:
            pass
