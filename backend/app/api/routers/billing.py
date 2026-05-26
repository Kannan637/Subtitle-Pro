"""Billing endpoints for Lemon Squeezy checkout creation."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()

PlanKey = Literal["creator", "studio"]

PLAN_CREDITS: dict[str, int] = {
    "creator": 300,
    "studio": 1500,
}

PLAN_LABELS: dict[str, str] = {
    "creator": "Subtitlepro Creator",
    "studio": "Subtitlepro Studio",
}


class CreateCheckoutRequest(BaseModel):
    plan: PlanKey


class CreateCheckoutResponse(BaseModel):
    provider: str = "lemonsqueezy"
    plan: PlanKey
    checkout_url: str


def _variant_id_for_plan(plan: str) -> str:
    if plan == "creator":
        return settings.ls_creator_variant_id.strip()
    if plan == "studio":
        return settings.ls_studio_variant_id.strip()
    return ""


def _frontend_origin(request: Request) -> str:
    configured = settings.frontend_app_url.strip().rstrip("/")
    if configured:
        return configured

    origin = request.headers.get("origin", "").strip().rstrip("/")
    if origin:
        return origin

    allowed = [o.strip().rstrip("/") for o in settings.cors_allowed_origins.split(",") if o.strip()]
    if allowed:
        return allowed[0]

    return str(request.base_url).rstrip("/")


def _checkout_payload(plan: str, variant_id: str, user: dict[str, Any], redirect_url: str) -> dict[str, Any]:
    product_options: dict[str, Any] = {
        "name": PLAN_LABELS[plan],
        "redirect_url": redirect_url,
        "receipt_button_text": "Open Subtitlepro",
        "receipt_link_url": redirect_url,
        "receipt_thank_you_note": "Your Subtitlepro plan is being activated.",
    }
    if variant_id.isdigit():
        product_options["enabled_variants"] = [int(variant_id)]

    return {
        "data": {
            "type": "checkouts",
            "attributes": {
                "product_options": product_options,
                "checkout_options": {
                    "embed": False,
                    "logo": True,
                    "media": True,
                    "desc": True,
                    "discount": True,
                    "subscription_preview": True,
                    "button_color": "#8B5CF6",
                },
                "checkout_data": {
                    "email": user.get("email") or "",
                    "name": user.get("name") or "",
                    "custom": {
                        "user_id": user["uid"],
                        "plan": plan,
                        "credits": str(PLAN_CREDITS[plan]),
                    },
                },
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
                "test_mode": settings.lemonsqueezy_test_mode,
            },
            "relationships": {
                "store": {
                    "data": {
                        "type": "stores",
                        "id": settings.lemonsqueezy_store_id.strip(),
                    }
                },
                "variant": {
                    "data": {
                        "type": "variants",
                        "id": variant_id,
                    }
                },
            },
        }
    }


def _assert_billing_configured(plan: str, variant_id: str) -> None:
    missing = []
    if not settings.lemonsqueezy_api_key.strip():
        missing.append("LEMONSQUEEZY_API_KEY")
    if not settings.lemonsqueezy_store_id.strip():
        missing.append("LEMONSQUEEZY_STORE_ID")
    if not variant_id:
        missing.append("LS_CREATOR_VARIANT_ID" if plan == "creator" else "LS_STUDIO_VARIANT_ID")

    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Secure checkout is not configured. Please contact support.",
        )


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    payload: CreateCheckoutRequest,
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> CreateCheckoutResponse:
    """Create a short-lived Lemon Squeezy checkout for the signed-in user."""
    plan = payload.plan
    current_plan = str(current_user.get("plan", "free") or "free").lower()
    if current_plan == plan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You are already on the {plan} plan.",
        )

    variant_id = _variant_id_for_plan(plan)
    _assert_billing_configured(plan, variant_id)

    frontend_origin = _frontend_origin(request)
    redirect_url = f"{frontend_origin}/dashboard/payment/success?plan={plan}"
    lemon_payload = _checkout_payload(plan, variant_id, current_user, redirect_url)

    headers = {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": f"Bearer {settings.lemonsqueezy_api_key.strip()}",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.lemonsqueezy.com/v1/checkouts",
                headers=headers,
                json=lemon_payload,
            )
    except httpx.HTTPError as exc:
        logger.error("Lemon Squeezy checkout request failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway is unavailable. Please retry in a moment.",
        ) from exc

    if response.status_code >= 400:
        logger.error(
            "Lemon Squeezy rejected checkout request: status=%s body=%s",
            response.status_code,
            response.text[:1000],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment checkout could not be started. Please retry or contact support.",
        )

    try:
        checkout_url = response.json()["data"]["attributes"]["url"]
    except (KeyError, TypeError, ValueError) as exc:
        logger.error("Unexpected Lemon Squeezy checkout response: %s", response.text[:1000])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway returned an invalid checkout response.",
        ) from exc

    return CreateCheckoutResponse(plan=plan, checkout_url=checkout_url)
