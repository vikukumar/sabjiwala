"""
Health check endpoints — health, readiness, liveness.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from sqlalchemy import text

from app.db.session import async_session_factory

router = APIRouter()


@router.get("")
@router.get("/")
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "sabjiwala-backend",
        "version": "1.0.0",
    }


@router.get("/ready")
async def readiness_check(request: Request):
    """Readiness probe — checks database and Redis connectivity."""
    checks = {}

    # Database check
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = "connected"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"

    # Redis check
    try:
        redis = getattr(request.app.state, "redis", None)
        if redis:
            await redis.ping()
            checks["redis"] = "connected"
        else:
            checks["redis"] = "not configured"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:100]}"

    all_healthy = all(v == "connected" for v in checks.values() if v != "not configured")

    return {
        "status": "ready" if all_healthy else "not ready",
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/live")
async def liveness_check():
    """Liveness probe — the process is alive."""
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}
