"""
Async database session management.

Provides connection pooling, session factory, and FastAPI dependency injection.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool

from app.core.config import settings

# Create async engine with connection pooling
engine = create_async_engine(
    settings.database_url,
    echo=settings.APP_DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    pool_timeout=30,
    poolclass=AsyncAdaptedQueuePool,
    connect_args={
        "server_settings": {
            "application_name": "sbjiwala_backend",
            "jit": "off",  # Disable JIT for connection pooling stability
        }
    },
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session per request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
