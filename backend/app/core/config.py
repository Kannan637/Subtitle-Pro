from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    api_v1_str: str = "/api/v1"
    project_name: str = "SubtitleAI Pro API"

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "subtitleai_pro"
    mongodb_server_selection_timeout_ms: int = 5000
    mongodb_connect_timeout_ms: int = 5000
    mongodb_socket_timeout_ms: int = 20000
    mongodb_max_pool_size: int = 50
    mongodb_fail_fast: bool = False

    # Firebase Admin
    firebase_credentials_path: str = ""  # Path to service account JSON
    firebase_project_id: str = "inflowr"
    firebase_auth_clock_skew_seconds: int = 60

    # Groq AI
    groq_api_key: str = ""

    # Pexels API (B-roll footage)
    pexels_api_key: str = ""

    # Cloudinary Integration
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Redis/BullMQ (for future use)
    redis_url: str = ""

    # Lemonsqueezy payments
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""
    lemonsqueezy_webhook_secret: str = ""
    lemonsqueezy_test_mode: bool = False

    # Lemonsqueezy Variant → Plan mapping (set variant IDs from LS dashboard)
    ls_creator_variant_id: str = ""
    ls_studio_variant_id: str = ""

    # Frontend URL used for checkout success redirects when Origin is unavailable
    frontend_app_url: str = ""

    # Social scheduler OAuth
    # Public API base used as OAuth redirect origin, e.g. https://app.example.com/api/v1
    social_oauth_api_base_url: str = ""
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    social_oauth_token_secret: str = ""
    youtube_oauth_client_id: str = ""
    youtube_oauth_client_secret: str = ""
    meta_oauth_client_id: str = ""
    meta_oauth_client_secret: str = ""
    meta_graph_version: str = "v22.0"
    tiktok_oauth_client_key: str = ""
    tiktok_oauth_client_secret: str = ""
    linkedin_oauth_client_id: str = ""
    linkedin_oauth_client_secret: str = ""
    x_oauth_client_id: str = ""
    x_oauth_client_secret: str = ""
    threads_oauth_client_id: str = ""
    threads_oauth_client_secret: str = ""
    social_scheduler_enabled: bool = True
    social_scheduler_poll_seconds: int = 30
    social_scheduler_batch_size: int = 10
    social_scheduler_publish_privacy_status: str = "public"

    # CORS — SEC-02 fix: comma-separated list of allowed origins
    # Dev default allows localhost. Override in production with exact domain(s).
    cors_allowed_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    cors_allow_origin_regex: str = ""

    # Upload limits — SEC-05 fix
    max_upload_size_bytes: int = 2 * 1024 * 1024 * 1024  # 2 GB

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
