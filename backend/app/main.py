from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.firebase_init import init_firebase
from app.db.database import connect_db, disconnect_db
from app.api.routers import api_router
from app.api.webhooks import router as webhooks_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up SubtitleAI Pro API...")

    # Initialize Firebase Admin SDK
    init_firebase()
    logger.info("Firebase Admin SDK initialized.")

    # Connect to MongoDB
    await connect_db()

    yield

    # Shutdown
    logger.info("Shutting down SubtitleAI Pro API...")
    await disconnect_db()


app = FastAPI(
    title=settings.project_name,
    openapi_url=f"{settings.api_v1_str}/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "SubtitleAI Pro API"}


# Router inclusion
app.include_router(api_router, prefix=settings.api_v1_str)
app.include_router(webhooks_router, prefix="/webhook", tags=["webhooks"])
