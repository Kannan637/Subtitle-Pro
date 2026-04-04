from fastapi import APIRouter
from app.api.routers import users, projects, media, transcription, translation, subtitles, analytics, export

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(media.router, tags=["media"])
api_router.include_router(transcription.router, tags=["transcription"])
api_router.include_router(translation.router, tags=["translation"])
api_router.include_router(subtitles.router, tags=["subtitles"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(export.router, tags=["export"])
