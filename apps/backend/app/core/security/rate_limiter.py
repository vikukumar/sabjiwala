"""
Rate Limiter — Token bucket algorithm backed by Redis.
"""
import time
from typing import Optional, Tuple

import structlog
from redis.asyncio import Redis

logger = structlog.get_logger()

RATE_LIMIT_PREFIX = "ratelimit:"


def parse_rate(rate_string: str) -> Tuple[int, int]:
    """Parse a rate string like '100/minute' into (limit, window_seconds)."""
    parts = rate_string.split("/")
    if len(parts) != 2:
        return 100, 60  # Default

    limit = int(parts[0])
    period = parts[1].lower().strip()

    windows = {
        "second": 1,
        "minute": 60,
        "hour": 3600,
        "day": 86400,
    }

    window = windows.get(period, 60)
    return limit, window


async def check_rate_limit(
    redis: Redis,
    key: str,
    limit: int,
    window: int,
) -> Tuple[bool, dict]:
    """
    Check if a rate limit has been exceeded using sliding window counter.

    Args:
        redis: Redis connection
        key: Rate limit key (e.g., "api:user:123" or "auth:ip:1.2.3.4")
        limit: Maximum requests allowed
        window: Time window in seconds

    Returns:
        Tuple of (is_allowed, info_dict)
    """
    now = time.time()
    redis_key = f"{RATE_LIMIT_PREFIX}{key}"

    pipe = redis.pipeline()

    # Remove old entries outside the window
    pipe.zremrangebyscore(redis_key, "-inf", now - window)
    # Add current request
    pipe.zadd(redis_key, {str(now): now})
    # Count requests in window
    pipe.zcard(redis_key)
    # Set expiry on the key
    pipe.expire(redis_key, window)

    results = await pipe.execute()
    request_count = results[2]

    info = {
        "limit": limit,
        "remaining": max(0, limit - request_count),
        "reset": int(now + window),
        "current": request_count,
    }

    if request_count > limit:
        await logger.awarning("Rate limit exceeded", key=key, count=request_count, limit=limit)
        return False, info

    return True, info


async def check_rate_limit_by_ip(
    redis: Redis,
    ip: str,
    rate_string: str,
    endpoint: str = "default",
) -> Tuple[bool, dict]:
    """Convenience: check rate limit by IP address."""
    limit, window = parse_rate(rate_string)
    key = f"ip:{ip}:{endpoint}"
    return await check_rate_limit(redis, key, limit, window)


async def check_rate_limit_by_user(
    redis: Redis,
    user_id: str,
    rate_string: str,
    endpoint: str = "default",
) -> Tuple[bool, dict]:
    """Convenience: check rate limit by user ID."""
    limit, window = parse_rate(rate_string)
    key = f"user:{user_id}:{endpoint}"
    return await check_rate_limit(redis, key, limit, window)
