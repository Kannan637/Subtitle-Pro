"""Credit management service — deduction, ledger, and usage stats."""
import logging
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


async def deduct_credits(
    db: Any,
    user_id: str,
    amount_sec: int,
    reference: str = "",
    note: str = "",
) -> int:
    """Deduct credits from user and log to ledger.

    Returns the new remaining balance.
    Raises ValueError if insufficient credits.
    """
    user = await db.users.find_one({"uid": user_id})
    if not user:
        raise ValueError(f"User {user_id} not found")

    current = user.get("credits_remaining", 0)
    if current < amount_sec:
        raise ValueError(
            f"Insufficient credits: have {current}min, need {amount_sec}min"
        )

    new_balance = current - amount_sec

    # Update user balance
    await db.users.update_one(
        {"uid": user_id},
        {"$set": {
            "credits_remaining": new_balance,
            "updated_at": datetime.now(timezone.utc),
        }},
    )

    # Append to credit ledger
    await db.credit_ledger.insert_one({
        "user_id": user_id,
        "type": "debit",
        "amount_sec": amount_sec,
        "reference": reference,
        "note": note,
        "created_at": datetime.now(timezone.utc),
    })

    logger.info(f"Deducted {amount_sec}min from user {user_id}. Balance: {new_balance}min")
    return new_balance


async def add_credits(
    db: Any,
    user_id: str,
    amount_sec: int,
    reference: str = "",
    note: str = "",
) -> int:
    """Add credits to user and log to ledger. Returns new balance."""
    result = await db.users.find_one_and_update(
        {"uid": user_id},
        {"$inc": {"credits_remaining": amount_sec},
         "$set": {"updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )

    await db.credit_ledger.insert_one({
        "user_id": user_id,
        "type": "credit",
        "amount_sec": amount_sec,
        "reference": reference,
        "note": note,
        "created_at": datetime.now(timezone.utc),
    })

    new_balance = result.get("credits_remaining", 0) if result else 0
    logger.info(f"Added {amount_sec}min to user {user_id}. Balance: {new_balance}min")
    return new_balance


async def get_usage_stats(db: Any, user_id: str) -> Dict[str, Any]:
    """Get usage statistics for a user."""
    user = await db.users.find_one({"uid": user_id})

    # Count projects
    project_count = await db.projects.count_documents({"user_id": user_id})

    # Count transcribed minutes (sum of debits)
    pipeline = [
        {"$match": {"user_id": user_id, "type": "debit"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_sec"}}},
    ]
    agg_result = await db.credit_ledger.aggregate(pipeline).to_list(1)
    total_used = agg_result[0]["total"] if agg_result else 0

    # Count languages used (distinct language_code in subtitle_tracks)
    lang_pipeline = [
        {"$lookup": {
            "from": "projects",
            "localField": "project_id",
            "foreignField": "_id",
            "as": "project",
        }},
        {"$match": {"project.user_id": user_id}},
        {"$group": {"_id": "$language_code"}},
    ]
    # Simplified: count subtitle tracks with distinct languages
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
        "minutes_transcribed": total_used,
        "languages_used": len(language_set),
        "history": history,
    }
