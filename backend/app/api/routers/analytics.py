"""Analytics router — usage stats and activity history."""
from fastapi import APIRouter, Depends

from app.db.database import get_database
from app.core.security import get_current_active_user
from app.services.credit_service import get_usage_stats

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/usage")
async def get_usage(
    current_user: dict = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Get usage statistics for the current user."""
    user_id = current_user.get("uid")
    stats = await get_usage_stats(db, user_id)
    return stats
