"""MongoDB connection via Motor (async driver)."""
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def format_database_error(exc: Exception) -> str:
    """Return a safe, user-facing database availability message."""
    text = str(exc).lower()
    if "getaddrinfo failed" in text or "dns" in text:
        return (
            "Database DNS resolution failed. Check MongoDB Atlas DNS/network "
            "connectivity and retry."
        )
    if "serverselectiontimeouterror" in exc.__class__.__name__.lower() or "server selection timeout" in text:
        return (
            "Database is temporarily unavailable. Check MongoDB Atlas network "
            "access, cluster status, and backend connectivity."
        )
    if "authentication failed" in text or "bad auth" in text:
        return "Database authentication failed. Check MongoDB credentials."
    return "Database is temporarily unavailable. Please retry in a moment."


def is_database_error(exc: Exception) -> bool:
    return isinstance(exc, PyMongoError)


async def connect_db() -> None:
    """Connect to MongoDB."""
    global _client, _db
    _client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
        connectTimeoutMS=settings.mongodb_connect_timeout_ms,
        socketTimeoutMS=settings.mongodb_socket_timeout_ms,
        maxPoolSize=settings.mongodb_max_pool_size,
        uuidRepresentation="standard",
    )
    _db = _client[settings.mongodb_db_name]

    # Verify connection
    try:
        await _client.admin.command("ping")
        logger.info(f"Connected to MongoDB: {settings.mongodb_db_name}")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {format_database_error(e)}")
        if settings.mongodb_fail_fast:
            raise
        logger.warning("Continuing startup with degraded database availability.")
        return

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
        # Phase-1 additions
        await _db.transcription_jobs.create_index([("project_id", 1), ("progress_pct", 1)])
        await _db.orchestration_jobs.create_index("project_id")
        await _db.orchestration_jobs.create_index([("project_id", 1), ("created_at", -1)])
        await _db.long_to_shorts_jobs.create_index("project_id")
        await _db.long_to_shorts_jobs.create_index([("project_id", 1), ("created_at", -1)])
        await _db.long_to_shorts_jobs.create_index([("project_id", 1), ("user_id", 1), ("created_at", -1)])
        await _db.project_settings.create_index([("project_id", 1), ("user_id", 1)], unique=True)
        await _db.media_files.create_index("proxy_path", sparse=True)
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Subtitlepro services are temporarily unavailable. Please retry in a moment.",
        )
    return _db
