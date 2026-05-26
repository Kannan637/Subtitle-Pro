"""Credit management service — deduction, ledger, and usage stats."""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

from pymongo import ReturnDocument

logger = logging.getLogger(__name__)


async def deduct_credits(
    db: Any,
    user_id: str,
    amount_credits: int,
    reference: str = "",
    note: str = "",
) -> int:
    """Atomically deduct credits from user and log to ledger.

    SEC-06 fix: Uses a single find_one_and_update with $gte filter to eliminate
    the read-then-write race condition. If the filter matches (user has enough
    credits), the deduction happens atomically. If it returns None, the user
    has insufficient credits.

    Returns the new remaining balance.
    Raises ValueError if insufficient credits.
    """
    result = await db.users.find_one_and_update(
        {
            "uid": user_id,
            "credits_remaining": {"$gte": amount_credits},  # atomic guard
        },
        {
            "$inc": {"credits_remaining": -amount_credits},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        return_document=ReturnDocument.AFTER,
    )

    if result is None:
        # Either user not found or insufficient credits — check which
        user = await db.users.find_one({"uid": user_id})
        if not user:
            raise ValueError(f"User {user_id} not found")
        current = user.get("credits_remaining", 0)
        raise ValueError(
            f"Insufficient credits: have {current} credits, need {amount_credits} credits"
        )

    new_balance = result.get("credits_remaining", 0)

    # Append to credit ledger
    await db.credit_ledger.insert_one({
        "user_id": user_id,
        "type": "debit",
        "amount_credits": amount_credits,
        "amount_sec": amount_credits,  # backward compatibility with existing analytics readers
        "reference": reference,
        "note": note,
        "created_at": datetime.now(timezone.utc),
    })

    logger.info(f'"Deducted {amount_credits} credits from user {user_id}. Balance: {new_balance} credits"')
    return new_balance


async def add_credits(
    db: Any,
    user_id: str,
    amount_credits: int,
    reference: str = "",
    note: str = "",
) -> int:
    """Add credits to user and log to ledger. Returns new balance."""
    result = await db.users.find_one_and_update(
        {"uid": user_id},
        {
            "$inc": {"credits_remaining": amount_credits},
            "$set": {"updated_at": datetime.now(timezone.utc)},
        },
        return_document=ReturnDocument.AFTER,
    )

    await db.credit_ledger.insert_one({
        "user_id": user_id,
        "type": "credit",
        "amount_credits": amount_credits,
        "amount_sec": amount_credits,  # backward compatibility with existing analytics readers
        "reference": reference,
        "note": note,
        "created_at": datetime.now(timezone.utc),
    })

    new_balance = result.get("credits_remaining", 0) if result else 0
    logger.info(f'"Added {amount_credits} credits to user {user_id}. Balance: {new_balance} credits"')
    return new_balance


async def get_usage_stats(db: Any, user_id: str) -> Dict[str, Any]:
    """Get usage statistics for a user."""
    user = await db.users.find_one({"uid": user_id})

    # Count projects
    project_count = await db.projects.count_documents({"user_id": user_id})

    # Count consumed credits (sum of debits)
    pipeline = [
        {"$match": {"user_id": user_id, "type": "debit"}},
        {"$project": {"amount": {"$ifNull": ["$amount_credits", "$amount_sec"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    agg_result = await db.credit_ledger.aggregate(pipeline).to_list(1)
    total_used = agg_result[0]["total"] if agg_result else 0

    # Count languages used (distinct language_code in subtitle_tracks)
    tracks_cursor = db.subtitle_tracks.find({"user_id": user_id})
    language_set = set()
    async for track in tracks_cursor:
        language_set.add(track.get("language_code", ""))

    # Recent activity (last 10 ledger entries)
    history_cursor = db.credit_ledger.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(10)
    history = []
    async for entry in history_cursor:
        entry["_id"] = str(entry["_id"])
        history.append(entry)

    return {
        "credits_remaining": user.get("credits_remaining", 0) if user else 0,
        "credits_used": total_used,
        "plan": user.get("plan", "free") if user else "free",
        "project_count": project_count,
        "minutes_transcribed": total_used,  # legacy key name, value is credits
        "languages_used": len(language_set),
        "history": history,
    }
