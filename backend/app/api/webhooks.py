"""Lemonsqueezy webhook handler — processes payment events and updates user plans."""
from fastapi import APIRouter, Request, HTTPException
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.db.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Plan credits (seconds) per plan ──────────────────────────────────────────
PLAN_CREDITS: dict[str, int] = {
    "free": 3600,        # 60 min
    "creator": 18000,    # 300 min
    "studio": 90000,     # 1500 min
}


def _resolve_plan_from_variant(variant_id: str) -> str:
    """Map a Lemonsqueezy variant ID to an internal plan name."""
    variant_map: dict[str, str] = {}
    if settings.ls_creator_variant_id:
        variant_map[settings.ls_creator_variant_id] = "creator"
    if settings.ls_studio_variant_id:
        variant_map[settings.ls_studio_variant_id] = "studio"
    return variant_map.get(str(variant_id), "")


def _resolve_plan_from_product_name(product_name: str) -> str:
    """Fallback: infer plan from product name if variant mapping is not set."""
    name_lower = product_name.lower()
    if "creator" in name_lower:
        return "creator"
    elif "studio" in name_lower:
        return "studio"
    elif "enterprise" in name_lower:
        return "enterprise"
    return ""


@router.post("/payment/")
async def lemonsqueezy_webhook(request: Request):
    """Handle incoming Lemonsqueezy webhook events."""
    raw_body = await request.body()
    signature = request.headers.get("x-signature")

    # ── Signature verification ───────────────────────────────────────────
    if settings.lemonsqueezy_webhook_secret:
        if not signature:
            logger.warning("Webhook received without signature")
            raise HTTPException(status_code=400, detail="Missing signature")

        secret = settings.lemonsqueezy_webhook_secret.encode("utf-8")
        expected = hmac.new(secret, msg=raw_body, digestmod=hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected, signature):
            logger.warning("Webhook signature mismatch")
            raise HTTPException(status_code=401, detail="Invalid signature")
    else:
        logger.info("Webhook secret not configured — skipping signature verification")

    # ── Parse payload ────────────────────────────────────────────────────
    try:
        event = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_name = event.get("meta", {}).get("event_name", "unknown")
    logger.info(f"Lemonsqueezy webhook event: {event_name}")

    # ── Route events ─────────────────────────────────────────────────────
    try:
        if event_name == "order_created":
            await _handle_order_created(event)
        elif event_name == "subscription_created":
            await _handle_subscription_created(event)
        elif event_name in ("subscription_updated", "subscription_cancelled", "subscription_expired"):
            await _handle_subscription_changed(event, event_name)
        else:
            logger.info(f"Unhandled webhook event: {event_name}")
    except Exception as e:
        logger.error(f"Error processing webhook event '{event_name}': {e}", exc_info=True)
        # Return 200 to avoid Lemonsqueezy retrying on app-level errors
        return {"status": "error", "message": str(e)}

    return {"status": "success", "event": event_name}


# ── Event Handlers ───────────────────────────────────────────────────────────

async def _handle_order_created(event: dict) -> None:
    """User completed a checkout — upgrade their plan."""
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})
    meta = event.get("meta", {})

    # Extract buyer email
    user_email = attrs.get("user_email", "")
    if not user_email:
        logger.error("order_created: no user_email in payload")
        return

    # Determine plan from variant or product name
    first_item = attrs.get("first_order_item", {})
    variant_id = str(first_item.get("variant_id", ""))
    product_name = first_item.get("product_name", "")

    plan = _resolve_plan_from_variant(variant_id)
    if not plan:
        plan = _resolve_plan_from_product_name(product_name)
    if not plan:
        logger.error(f"order_created: could not resolve plan for variant={variant_id}, product='{product_name}'")
        return

    # Find user by email
    user = await db.users.find_one({"email": user_email})
    if not user:
        logger.warning(f"order_created: no user found for email {user_email}")
        return

    # Update user plan and credits
    new_credits = PLAN_CREDITS.get(plan, 3600)
    now = datetime.now(timezone.utc)

    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {
            "plan": plan,
            "credits_remaining": new_credits,
            "updated_at": now,
        }}
    )

    # Store subscription record
    order_id = str(data.get("id", ""))
    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {"$set": {
            "user_id": user["uid"],
            "ls_order_id": order_id,
            "plan": plan,
            "status": "active",
            "updated_at": now,
        },
        "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    logger.info(f"✅ Upgraded user {user_email} to plan '{plan}' (order {order_id})")


async def _handle_subscription_created(event: dict) -> None:
    """Recurring subscription activated."""
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})

    user_email = attrs.get("user_email", "")
    if not user_email:
        return

    variant_id = str(attrs.get("variant_id", ""))
    product_name = attrs.get("product_name", "")

    plan = _resolve_plan_from_variant(variant_id) or _resolve_plan_from_product_name(product_name)
    if not plan:
        logger.error(f"subscription_created: could not resolve plan for variant={variant_id}")
        return

    user = await db.users.find_one({"email": user_email})
    if not user:
        logger.warning(f"subscription_created: no user for {user_email}")
        return

    now = datetime.now(timezone.utc)
    sub_id = str(data.get("id", ""))

    await db.users.update_one(
        {"uid": user["uid"]},
        {"$set": {
            "plan": plan,
            "credits_remaining": PLAN_CREDITS.get(plan, 3600),
            "updated_at": now,
        }}
    )

    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {"$set": {
            "ls_subscription_id": sub_id,
            "plan": plan,
            "status": "active",
            "updated_at": now,
        },
        "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    logger.info(f"✅ Subscription created for {user_email}, plan='{plan}'")


async def _handle_subscription_changed(event: dict, event_name: str) -> None:
    """Subscription updated, cancelled, or expired — may downgrade user."""
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})

    user_email = attrs.get("user_email", "")
    if not user_email:
        return

    user = await db.users.find_one({"email": user_email})
    if not user:
        return

    now = datetime.now(timezone.utc)
    ls_status = attrs.get("status", "")

    # Map LS status to internal status
    if event_name == "subscription_cancelled" or ls_status == "cancelled":
        internal_status = "canceled"
    elif event_name == "subscription_expired" or ls_status == "expired":
        internal_status = "expired"
    else:
        internal_status = ls_status or "active"

    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {"$set": {"status": internal_status, "updated_at": now}},
    )

    # Downgrade to free if cancelled or expired
    if internal_status in ("canceled", "expired"):
        await db.users.update_one(
            {"uid": user["uid"]},
            {"$set": {
                "plan": "free",
                "credits_remaining": PLAN_CREDITS["free"],
                "updated_at": now,
            }}
        )
        logger.info(f"⬇️ Downgraded {user_email} to free (subscription {internal_status})")
    else:
        logger.info(f"Subscription updated for {user_email}: status={internal_status}")
