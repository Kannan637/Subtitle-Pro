from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from pymongo.errors import PyMongoError
from app.core.limiter import limiter
import logging
import asyncio
import time
import uuid

from app.core.config import settings
from app.core.firebase_init import init_firebase
from app.db.database import connect_db, disconnect_db, format_database_error, get_database
from app.api.routers import api_router
from app.api.routers.social_scheduler import social_scheduler_loop
from app.api.webhooks import router as webhooks_router

# ── Structured logging setup ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": %(message)s}',
)
logger = logging.getLogger(__name__)

# ── ARCH-04: Rate limiter (slowapi) ──────────────────────────────────────────
# limiter is defined in app.core.limiter to avoid circular imports


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('"Starting up SubtitleAI Pro API..."')

    if not settings.lemonsqueezy_webhook_secret:
        logger.warning(
            '"SECURITY WARNING: LEMONSQUEEZY_WEBHOOK_SECRET is not set. '
            'Webhook signature verification is DISABLED!"'
        )

    init_firebase()
    logger.info('"Firebase Admin SDK initialized."')
    await connect_db()
    scheduler_stop_event = asyncio.Event()
    app.state.social_scheduler_stop_event = scheduler_stop_event
    app.state.social_scheduler_task = asyncio.create_task(
        social_scheduler_loop(get_database(), scheduler_stop_event)
    )

    yield

    logger.info('"Shutting down SubtitleAI Pro API..."')
    scheduler_stop_event.set()
    scheduler_task = getattr(app.state, "social_scheduler_task", None)
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    await disconnect_db()


app = FastAPI(
    title=settings.project_name,
    openapi_url=f"{settings.api_v1_str}/openapi.json",
    lifespan=lifespan,
)

# Attach rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — SEC-02 fix ─────────────────────────────────────────────────────────
_allowed_origins = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
_allow_origin_regex = settings.cors_allow_origin_regex.strip() or None
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request-ID middleware — BE-02 ─────────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.time()
    try:
        response = await call_next(request)
        duration_ms = round((time.time() - start) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            f'"method": "{request.method}", "path": "{request.url.path}", '
            f'"status": {response.status_code}, "duration_ms": {duration_ms}, '
            f'"request_id": "{request_id}"'
        )
        return response
    except PyMongoError as exc:
        duration_ms = round((time.time() - start) * 1000)
        detail = format_database_error(exc)
        logger.error(
            f'"Database unavailable", "request_id": "{request_id}", '
            f'"path": "{request.url.path}", "duration_ms": {duration_ms}, '
            f'"error": "{type(exc).__name__}: {detail}"',
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": detail,
                "code": "database_unavailable",
                "request_id": request_id,
            },
            headers={"X-Request-ID": request_id, "Retry-After": "10"},
        )


# ── Global exception handler — BE-01 ─────────────────────────────────────────
@app.exception_handler(PyMongoError)
async def pymongo_exception_handler(request: Request, exc: PyMongoError):
    request_id = getattr(request.state, "request_id", "unknown")
    detail = format_database_error(exc)
    logger.error(
        f'"Database unavailable", "request_id": "{request_id}", '
        f'"path": "{request.url.path}", "error": "{type(exc).__name__}: {detail}"',
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": detail,
            "code": "database_unavailable",
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id, "Retry-After": "10"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        f'"Internal server error", "request_id": "{request_id}", '
        f'"path": "{request.url.path}", "error": "{type(exc).__name__}: {str(exc)}"',
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "request_id": request_id},
    )


# ── Real health check — ARCH-07 ───────────────────────────────────────────────
@app.get("/health")
async def health_check():
    import firebase_admin
    health: dict = {"status": "healthy", "db": "unknown", "firebase": "unknown"}
    overall_ok = True

    try:
        db = get_database()
        await db.command("ping")
        health["db"] = "ok"
    except Exception as e:
        health["db"] = f"error: {format_database_error(e)}"
        overall_ok = False

    try:
        health["firebase"] = "ok" if firebase_admin._apps else "not initialized"
        if not firebase_admin._apps:
            overall_ok = False
    except Exception as e:
        health["firebase"] = f"error: {str(e)}"
        overall_ok = False

    health["status"] = "healthy" if overall_ok else "degraded"
    return JSONResponse(status_code=200 if overall_ok else 503, content=health)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.api_v1_str)
app.include_router(webhooks_router, prefix="/webhook", tags=["webhooks"])

# End of main.py
