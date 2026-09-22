import os
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# --- Database ---
db = SQLAlchemy()

# --- JWT auth ---
jwt = JWTManager()

# Simple in-memory blacklist (dev only — resets when server restarts)
blacklisted_tokens = set()

# --- Rate limiter ---
# Keyed by IP address by default. Storage defaults to in-memory ("memory://"),
# which is fine for a single-process dev/test setup. For production with multiple
# workers, point storage_uri at Redis (e.g. redis://localhost:6379) via RATELIMIT_STORAGE_URI.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://")
)
