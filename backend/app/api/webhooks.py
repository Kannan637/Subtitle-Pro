"""Lemon Squeezy webhook handler for plan and credit synchronization."""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.db.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter()

PLAN_CREDITS: dict[str, int] = {
    "free": 60,
    "creator": 300,
    "studio": 1500,
    "enterprise": 1500,
}

VALID_PAID_PLANS = {"creator", "studio", "enterprise"}


def _resolve_plan_from_variant(variant_id: str) -> str:
    variant_map: dict[str, str] = {}
    if settings.ls_creator_variant_id:
        variant_map[str(settings.ls_creator_variant_id)] = "creator"
    if settings.ls_studio_variant_id:
        variant_map[str(settings.ls_studio_variant_id)] = "studio"
    return variant_map.get(str(variant_id), "")


def _resolve_plan_from_product_name(product_name: str) -> str:
    name_lower = (product_name or "").lower()
    if "creator" in name_lower:
        return "creator"
    if "studio" in name_lower:
        return "studio"
    if "enterprise" in name_lower:
        return "enterprise"
    return ""


def _custom_data(event: dict[str, Any]) -> dict[str, Any]:
    custom = event.get("meta", {}).get("custom_data", {})
    return custom if isinstance(custom, dict) else {}


def _resolve_plan(event: dict[str, Any], attrs: dict[str, Any]) -> str:
    custom_plan = str(_custom_data(event).get("plan", "")).lower()
    if custom_plan in VALID_PAID_PLANS:
        return custom_plan

    first_item = attrs.get("first_order_item", {})
    if not isinstance(first_item, dict):
        first_item = {}

    variant_id = str(attrs.get("variant_id") or first_item.get("variant_id") or "")
    product_name = str(attrs.get("product_name") or first_item.get("product_name") or "")

    return _resolve_plan_from_variant(variant_id) or _resolve_plan_from_product_name(product_name)


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        raw = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


async def _find_user(db: Any, event: dict[str, Any], attrs: dict[str, Any]) -> dict[str, Any] | None:
    custom = _custom_data(event)
    uid = str(custom.get("user_id") or custom.get("uid") or "").strip()
    if uid:
        user = await db.users.find_one({"uid": uid})
        if user:
            return user

    email = str(attrs.get("user_email") or custom.get("email") or "").strip()
    if email:
        return await db.users.find_one({"email": email})

    return None


def _subscription_payload(data: dict[str, Any], attrs: dict[str, Any], plan: str, status_value: str) -> dict[str, Any]:
    first_item = attrs.get("first_subscription_item", {})
    if not isinstance(first_item, dict):
        first_item = {}

    return {
        "ls_subscription_id": str(data.get("id", "")),
        "ls_order_id": str(attrs.get("order_id", "")),
        "ls_customer_id": str(attrs.get("customer_id", "")),
        "ls_variant_id": str(attrs.get("variant_id", "")),
        "ls_product_id": str(attrs.get("product_id", "")),
        "ls_subscription_item_id": str(first_item.get("id", "")),
        "plan": plan,
        "status": status_value,
        "renews_at": attrs.get("renews_at"),
        "ends_at": attrs.get("ends_at"),
        "trial_ends_at": attrs.get("trial_ends_at"),
        "test_mode": bool(attrs.get("test_mode", False)),
        "updated_at": datetime.now(timezone.utc),
    }


async def _set_user_plan(db: Any, user: dict[str, Any], plan: str, reference: str) -> None:
    now = datetime.now(timezone.utc)
    credits = PLAN_CREDITS.get(plan, PLAN_CREDITS["free"])
    await db.users.update_one(
        {"uid": user["uid"]},
        {
            "$set": {
                "plan": plan,
                "credits_remaining": credits,
                "credits_unit": "credits",
                "billing_provider": "lemonsqueezy",
                "updated_at": now,
            }
        },
    )
    await db.credit_ledger.insert_one(
        {
            "user_id": user["uid"],
            "type": "credit",
            "amount_credits": credits,
            "amount_sec": credits,
            "reference": reference,
            "note": f"Lemon Squeezy plan activation: {plan}",
            "created_at": now,
        }
    )


async def _handle_order_created(event: dict[str, Any]) -> None:
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})
    if not isinstance(data, dict) or not isinstance(attrs, dict):
        raise ValueError("Invalid order payload")

    plan = _resolve_plan(event, attrs)
    if not plan:
        logger.error("order_created: could not resolve plan")
        return

    user = await _find_user(db, event, attrs)
    if not user:
        logger.warning("order_created: no matching user for email=%s", attrs.get("user_email"))
        return

    order_id = str(data.get("id", ""))
    await _set_user_plan(db, user, plan, reference=f"ls_order:{order_id}")
    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {
            "$set": {
                "user_id": user["uid"],
                "ls_order_id": order_id,
                "ls_customer_id": str(attrs.get("customer_id", "")),
                "plan": plan,
                "status": str(attrs.get("status", "paid") or "paid"),
                "test_mode": bool(attrs.get("test_mode", False)),
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )
    logger.info("Activated plan '%s' for user %s from order %s", plan, user["uid"], order_id)


async def _handle_subscription_created_or_updated(event: dict[str, Any], event_name: str) -> None:
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})
    if not isinstance(data, dict) or not isinstance(attrs, dict):
        raise ValueError("Invalid subscription payload")

    plan = _resolve_plan(event, attrs)
    if not plan:
        logger.error("%s: could not resolve plan", event_name)
        return

    user = await _find_user(db, event, attrs)
    if not user:
        logger.warning("%s: no matching user for email=%s", event_name, attrs.get("user_email"))
        return

    subscription_status = str(attrs.get("status", "") or "active")
    subscription_payload = _subscription_payload(data, attrs, plan, subscription_status)
    subscription_payload["user_id"] = user["uid"]

    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {"$set": subscription_payload, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )

    if subscription_status in {"active", "on_trial", "paid"} or event_name == "subscription_created":
        await _set_user_plan(db, user, plan, reference=f"ls_subscription:{data.get('id', '')}")

    logger.info("Synced subscription %s for user %s as %s/%s", data.get("id", ""), user["uid"], plan, subscription_status)


async def _handle_subscription_terminal(event: dict[str, Any], event_name: str) -> None:
    db = get_database()
    data = event.get("data", {})
    attrs = data.get("attributes", {})
    if not isinstance(data, dict) or not isinstance(attrs, dict):
        raise ValueError("Invalid subscription payload")

    user = await _find_user(db, event, attrs)
    if not user:
        logger.warning("%s: no matching user for email=%s", event_name, attrs.get("user_email"))
        return

    status_value = str(attrs.get("status", "") or event_name.replace("subscription_", ""))
    plan = _resolve_plan(event, attrs) or str(user.get("plan", "free"))

    await db.subscriptions.update_one(
        {"user_id": user["uid"]},
        {
            "$set": {
                **_subscription_payload(data, attrs, plan, status_value),
                "user_id": user["uid"],
            },
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )

    ends_at = _parse_datetime(attrs.get("ends_at"))
    should_downgrade = event_name == "subscription_expired" or status_value in {"expired", "unpaid"}
    if event_name == "subscription_cancelled" and ends_at and ends_at <= datetime.now(timezone.utc):
        should_downgrade = True

    if should_downgrade:
        await db.users.update_one(
            {"uid": user["uid"]},
            {
                "$set": {
                    "plan": "free",
                    "credits_remaining": PLAN_CREDITS["free"],
                    "credits_unit": "credits",
                    "billing_provider": "lemonsqueezy",
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        logger.info("Downgraded user %s to free after %s", user["uid"], event_name)
    else:
        logger.info("Recorded %s for user %s without immediate downgrade", event_name, user["uid"])


@router.post("/payment/")
async def lemonsqueezy_webhook(request: Request) -> dict[str, str]:
    raw_body = await request.body()
    signature = request.headers.get("x-signature", "")

    if settings.lemonsqueezy_webhook_secret:
        secret = settings.lemonsqueezy_webhook_secret.encode("utf-8")
        expected = hmac.new(secret, msg=raw_body, digestmod=hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(expected, signature):
            logger.warning("Lemon Squeezy webhook signature mismatch")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    else:
        logger.warning("LEMONSQUEEZY_WEBHOOK_SECRET is not configured; accepting unsigned webhook")

    try:
        event = json.loads(raw_body)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body") from exc

    event_name = str(event.get("meta", {}).get("event_name") or request.headers.get("x-event-name") or "unknown")
    logger.info("Lemon Squeezy webhook event: %s", event_name)

    if event_name == "order_created":
        await _handle_order_created(event)
    elif event_name in {"subscription_created", "subscription_updated", "subscription_resumed"}:
        await _handle_subscription_created_or_updated(event, event_name)
    elif event_name in {"subscription_cancelled", "subscription_expired"}:
        await _handle_subscription_terminal(event, event_name)
    else:
        logger.info("Unhandled Lemon Squeezy webhook event: %s", event_name)

    return {"status": "success", "event": event_name}
