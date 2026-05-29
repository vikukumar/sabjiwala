"""
Core Middleware — Security Headers, Audit Logging, Rate Limiting.
"""
import time
import json
from typing import Callable
from uuid import UUID

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from redis.asyncio import Redis

from app.core.config import settings

logger = structlog.get_logger()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add OWASP-recommended security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self), payment=(self)"
        )

        if not settings.APP_DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: blob: https://*.tile.openstreetmap.org; "
                "connect-src 'self' wss: https://nominatim.openstreetmap.org https://router.project-osrm.org; "
                "frame-ancestors 'none';"
            )

        return response


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Log all API mutations (POST, PUT, PATCH, DELETE) to the audit log."""

    SKIP_PATHS = {"/api/docs", "/api/redoc", "/api/openapi.json", "/health", "/ready", "/live"}
    MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        start_time = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start_time) * 1000

        if request.method in self.MUTATION_METHODS:
            user_id = None
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    from app.core.security.jwt import decode_token
                    payload = decode_token(auth_header.split(" ", 1)[1])
                    user_id = payload.get("sub")
                except Exception:
                    pass

            await logger.ainfo(
                "api_mutation",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=round(duration_ms, 2),
                user_id=user_id,
                ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", "")[:200],
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Global rate limiting middleware using Redis sliding window."""

    # Rate limits by path prefix
    RATE_LIMITS = {
        "/api/v1/auth": "10/minute",
        "/api/v1/storage/upload": "5/minute",
        "/api/v1/": "100/minute",
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        redis: Redis | None = getattr(request.app.state, "redis", None)
        if not redis:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Find matching rate limit
        rate_string = "100/minute"
        for prefix, rate in self.RATE_LIMITS.items():
            if path.startswith(prefix):
                rate_string = rate
                break

        from app.core.security.rate_limiter import check_rate_limit_by_ip
        allowed, info = await check_rate_limit_by_ip(redis, client_ip, rate_string, path)

        if not allowed:
            return Response(
                content=json.dumps({
                    "detail": "Rate limit exceeded",
                    "retry_after": info.get("reset", 60) - int(time.time()),
                }),
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(info["reset"]),
                    "Retry-After": str(info.get("reset", 60) - int(time.time())),
                },
            )

        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(info["reset"])

        return response
