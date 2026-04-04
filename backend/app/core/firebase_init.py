"""Firebase Admin SDK initialization."""
import firebase_admin
from firebase_admin import credentials
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)


def init_firebase() -> None:
    """Initialize Firebase Admin SDK.

    Tries in order:
    1. Service account JSON file from FIREBASE_CREDENTIALS_PATH env var
    2. GOOGLE_APPLICATION_CREDENTIALS env var (standard Firebase approach)
    3. Default credentials (works in GCP environments)
    """
    if firebase_admin._apps:
        logger.info("Firebase Admin already initialized.")
        return

    cred_path = settings.firebase_credentials_path

    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin initialized with service account: {cred_path}")
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
        logger.info("Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS.")
    else:
        # Initialize without credentials — will only work for token verification
        # if the project ID can be determined. We pass it explicitly.
        try:
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
            logger.info(f"Firebase Admin initialized with project ID: {settings.firebase_project_id}")
        except Exception as e:
            logger.warning(
                f"Firebase Admin initialization failed: {e}. "
                "Token verification will not work. Set FIREBASE_CREDENTIALS_PATH in .env"
            )
