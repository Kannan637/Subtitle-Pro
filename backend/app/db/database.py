"""MongoDB connection via Motor (async driver)."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Connect to MongoDB."""
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _db = _client[settings.mongodb_db_name]

    # Verify connection
    try:
        await _client.admin.command("ping")
        logger.info(f"Connected to MongoDB: {settings.mongodb_db_name}")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise

    # Create indexes for all collections (PRD §3.6)
    # Drop stale unique index on transcription_jobs if it exists
    try:
        await _db.transcription_jobs.drop_index("project_id_1")
    except Exception:
        pass

    try:
        await _db.users.create_index("uid", unique=True)
        await _db.users.create_index("email")
        await _db.projects.create_index("user_id")
        await _db.projects.create_index([("user_id", 1), ("created_at", -1)])
        await _db.media_files.create_index("project_id", unique=True)
        await _db.transcription_jobs.create_index("project_id")
        await _db.subtitle_tracks.create_index("project_id")
        await _db.subtitle_cues.create_index("track_id")
        await _db.translation_jobs.create_index("project_id")
        await _db.credit_ledger.create_index("user_id")
        await _db.subscriptions.create_index("user_id")
        await _db.subscriptions.create_index("stripe_sub_id", unique=True, sparse=True)
        logger.info("MongoDB indexes ensured for all collections.")
    except Exception as e:
        logger.warning(f"Index creation warning (non-fatal): {e}")


async def disconnect_db() -> None:
    """Disconnect from MongoDB."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("Disconnected from MongoDB.")


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance. Use as FastAPI dependency."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
