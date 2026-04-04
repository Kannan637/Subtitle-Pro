from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    api_v1_str: str = "/api/v1"
    project_name: str = "SubtitleAI Pro API"

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "subtitleai_pro"

    # Firebase Admin
    firebase_credentials_path: str = ""  # Path to service account JSON
    firebase_project_id: str = "inflowr"

    # Groq AI
    groq_api_key: str = ""

    # Redis/BullMQ (for future use)
    redis_url: str = ""

    # Lemonsqueezy Webhook Secret
    lemonsqueezy_webhook_secret: str = ""

    # Lemonsqueezy Variant → Plan mapping (set variant IDs from LS dashboard)
    ls_creator_variant_id: str = ""
    ls_studio_variant_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
