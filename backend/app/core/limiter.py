from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared rate-limiter instance — imported by main.py and any router that needs
# per-endpoint limits (e.g. transcription).  Defining it here avoids the
# circular-import that occurs when routers try to import from app.main.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
