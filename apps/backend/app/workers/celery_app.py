"""
Celery Background Tasks Engine.
"""
from celery import Celery
import structlog
from app.core.config import settings

logger = structlog.get_logger()

# Configure Celery to use Redis broker and backend
celery_app = Celery(
    "sabjiwala_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
)

@celery_app.task(name="app.workers.tasks.cleanup_expired_otps")
def cleanup_expired_otps():
    """Background task to remove expired OTPs from the database."""
    logger.info("Executing Celery background task: cleanup_expired_otps")
    return {"status": "success", "cleaned": 0}

@celery_app.task(name="app.workers.tasks.trigger_daily_settlement")
def trigger_daily_settlement():
    """Background task to trigger vendor settlements daily."""
    logger.info("Executing Celery background task: trigger_daily_settlement")
    return {"status": "success", "processed": 0}
