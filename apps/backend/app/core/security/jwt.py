"""
JWT Token Management — access tokens, refresh tokens with rotation, device binding.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import UUID

import jwt
import structlog
from redis.asyncio import Redis

from app.core.config import settings

logger = structlog.get_logger()

# Token type constants
ACCESS_TOKEN = "access"
REFRESH_TOKEN = "refresh"

# Redis key prefixes
BLACKLIST_PREFIX = "token:blacklist:"
REFRESH_TOKEN_PREFIX = "token:refresh:"
USER_SESSIONS_PREFIX = "user:sessions:"


def create_access_token(
    user_id: UUID,
    user_type: str,
    device_id: Optional[str] = None,
    permissions: Optional[list[str]] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN,
        "user_type": user_type,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_hex(16),
    }
    if device_id:
        payload["device_id"] = device_id
    if permissions:
        payload["permissions"] = permissions
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: UUID,
    user_type: Optional[str] = None,
    device_id: Optional[str] = None,
    session_id: Optional[UUID] = None,
) -> tuple[str, str]:
    """
    Create a refresh token. Returns (token_string, token_hash).
    The hash is stored in the database for rotation validation.
    """
    now = datetime.now(timezone.utc)
    token_id = secrets.token_hex(32)

    payload = {
        "sub": str(user_id),
        "type": REFRESH_TOKEN,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        "jti": token_id,
    }
    if user_type:
        payload["user_type"] = user_type
    if device_id:
        payload["device_id"] = device_id
    if session_id:
        payload["session_id"] = str(session_id)

    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    return token, token_hash


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token. Raises jwt.InvalidTokenError on failure."""
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["sub", "type", "exp", "jti"]},
    )


async def blacklist_token(redis: Redis, jti: str, expires_in: int = 900) -> None:
    """Add a token JTI to the blacklist (for logout/rotation)."""
    key = f"{BLACKLIST_PREFIX}{jti}"
    await redis.setex(key, expires_in, "1")


async def is_token_blacklisted(redis: Redis, jti: str) -> bool:
    """Check if a token JTI is in the blacklist."""
    key = f"{BLACKLIST_PREFIX}{jti}"
    return bool(await redis.exists(key) > 0)


async def store_refresh_token(
    redis: Redis,
    user_id: UUID,
    token_hash: str,
    device_id: Optional[str] = None,
    expires_days: int = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
) -> None:
    """Store refresh token hash in Redis for rotation tracking."""
    key = f"{REFRESH_TOKEN_PREFIX}{token_hash}"
    data = {
        "user_id": str(user_id),
        "device_id": device_id or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.hset(key, mapping=data)  # type: ignore
    await redis.expire(key, expires_days * 86400)

    # Track user sessions
    session_key = f"{USER_SESSIONS_PREFIX}{user_id}"
    await redis.sadd(session_key, token_hash)  # type: ignore
    await redis.expire(session_key, expires_days * 86400)


async def revoke_refresh_token(redis: Redis, token_hash: str) -> None:
    """Revoke a specific refresh token."""
    key = f"{REFRESH_TOKEN_PREFIX}{token_hash}"
    data = await redis.hgetall(key)  # type: ignore
    if data:
        user_id = data.get(b"user_id", data.get("user_id", ""))
        if isinstance(user_id, bytes):
            user_id = user_id.decode()
        session_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        await redis.srem(session_key, token_hash)  # type: ignore
    await redis.delete(key)


async def revoke_all_user_sessions(redis: Redis, user_id: UUID) -> int:
    """Revoke all refresh tokens for a user. Returns count of revoked sessions."""
    session_key = f"{USER_SESSIONS_PREFIX}{user_id}"
    token_hashes = await redis.smembers(session_key)  # type: ignore
    count = 0
    for token_hash in token_hashes:
        if isinstance(token_hash, bytes):
            token_hash = token_hash.decode()
        key = f"{REFRESH_TOKEN_PREFIX}{token_hash}"
        await redis.delete(key)
        count += 1
    await redis.delete(session_key)
    return count


async def rotate_refresh_token(
    redis: Redis,
    old_token: str,
    user_id: UUID,
    user_type: str,
    device_id: Optional[str] = None,
    permissions: Optional[list[str]] = None,
) -> Dict[str, str]:
    """
    Rotate refresh token: revoke old token, issue new access + refresh pair.
    Implements refresh token rotation for security with a 60-second concurrency grace period.
    """
    old_token_hash = hashlib.sha256(old_token.encode()).hexdigest()

    # Check grace period cache first to prevent concurrent requests from triggering revocation
    grace_key = f"rotated:{old_token_hash}"
    grace_data = await redis.get(grace_key)
    if grace_data:
        import json
        try:
            return json.loads(grace_data)
        except Exception:
            pass

    # Check if old token exists in Redis
    key = f"{REFRESH_TOKEN_PREFIX}{old_token_hash}"
    exists = await redis.exists(key)

    if not exists:
        # Token reuse detected — possible token theft
        # Revoke all sessions for this user as a safety measure
        await revoke_all_user_sessions(redis, user_id)
        await logger.awarning(
            "Refresh token reuse detected — all sessions revoked",
            user_id=str(user_id),
        )
        raise ValueError("Token has been revoked. All sessions invalidated for security.")

    # Revoke old refresh token
    await revoke_refresh_token(redis, old_token_hash)

    # Issue new tokens
    access_token = create_access_token(user_id, user_type, device_id, permissions)
    new_refresh_token, new_token_hash = create_refresh_token(user_id, user_type, device_id)

    # Store new refresh token
    await store_refresh_token(redis, user_id, new_token_hash, device_id)

    tokens = {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }

    # Save to grace period cache for 60 seconds
    import json
    await redis.setex(grace_key, 60, json.dumps(tokens))

    return tokens
