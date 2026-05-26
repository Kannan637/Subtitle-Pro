from fastapi import APIRouter
from app.api.routers import (
    analytics,
    billing,
    broll,
    control_panel,
    export,
    long_to_shorts,
    media,
    motion_graphics,
    orchestrator,
    projects,
    social_scheduler,
    subtitles,
    transcription,
    translation,
    users,
)

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(media.router, tags=["media"])
api_router.include_router(transcription.router, tags=["transcription"])
api_router.include_router(translation.router, tags=["translation"])
api_router.include_router(subtitles.router, tags=["subtitles"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(export.router, tags=["export"])
api_router.include_router(broll.router, tags=["B-roll"])
api_router.include_router(motion_graphics.router, tags=["motion-graphics"])
api_router.include_router(orchestrator.router, tags=["orchestrator"])
api_router.include_router(control_panel.router, tags=["control-panel"])
api_router.include_router(long_to_shorts.router, tags=["long-to-shorts"])
api_router.include_router(social_scheduler.router, tags=["social-scheduler"])

