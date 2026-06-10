"""Sbjiwala Backend Application - Main Entry Point."""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware, AuditLogMiddleware, RateLimitMiddleware
from app.db.engine import schema_evolution_engine
from app.db.session import engine as db_engine, async_session_factory
from app.db.base import Base  # noqa: F401 - required to register all models
from app.api.v1.router import api_router
from app.websocket.manager import ws_manager
from app.core.rbac.seed import seed_default_roles_and_permissions
from app.workers.celery_app import celery_app  # noqa: F401

# Import all models so they register with Base.metadata
import app.models  # noqa: F401

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan - startup and shutdown."""
    # --- Startup ---
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.ConsoleRenderer() if settings.APP_DEBUG else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.LOG_LEVEL)
        ),
    )
    await logger.ainfo("Starting Sbjiwala Backend", version="1.0.0", env=settings.APP_ENV)

    # Generate E2EE RSA keypair dynamically for this startup session
    from cryptography.hazmat.primitives.asymmetric import rsa
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    app.state.rsa_private_key = private_key
    app.state.rsa_public_key = private_key.public_key()
    await logger.ainfo("E2EE Dynamic RSA Keypair generated successfully")

    # Run auto schema evolution
    await schema_evolution_engine.evolve(db_engine)
    await logger.ainfo("Schema evolution completed")

    # Alter payments.order_id to drop NOT NULL (migration engine is additive-only)
    from sqlalchemy import text
    async with db_engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE "payments" ALTER COLUMN "order_id" DROP NOT NULL;'))
            await logger.ainfo("Altered payments.order_id column to DROP NOT NULL")
        except Exception as e:
            await logger.ainfo(f"Altered payments.order_id check skipped/failed: {e}")

    # Seed default RBAC roles and permissions
    async with async_session_factory() as session:
        await seed_default_roles_and_permissions(session)
        from app.db.seed import seed_database
        await seed_database(session)
        await session.commit()
    await logger.ainfo("RBAC and catalog database seed completed")

    # Connect WebSocket manager to Redis
    await ws_manager.connect_redis()
    await logger.ainfo("WebSocket manager connected to Redis")

    yield

    # --- Shutdown ---
    await ws_manager.disconnect_redis()
    await db_engine.dispose()
    await logger.ainfo("Sbjiwala Backend shut down gracefully")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        description="Production-grade multi-tenant vegetable commerce platform",
        version="1.0.0",
        docs_url="/api/docs" if settings.APP_DEBUG else None,
        redoc_url="/api/redoc" if settings.APP_DEBUG else None,
        openapi_url="/api/openapi.json" if settings.APP_DEBUG else None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security Headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Audit Logging
    app.add_middleware(AuditLogMiddleware)

    # Rate Limiting
    if settings.RATE_LIMIT_ENABLED:
        app.add_middleware(RateLimitMiddleware)

    # API Routes
    app.include_router(api_router, prefix="/api/v1")

    # WebSocket Route
    from app.websocket.handlers import router as ws_router
    app.include_router(ws_router)

    # Serve Next.js static UI files at root
    import os
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse, Response
    
    # Path to nextjs build out folder
    ui_dir = settings.UI_DIR or os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../sbjiwala-web/out"))
    if os.path.exists(ui_dir):
        class SPAStaticFiles(StaticFiles):
            async def get_response(self, path: str, scope) -> Response:
                directory = self.directory
                if not directory:
                    raise RuntimeError("StaticFiles directory is not configured")
                # If path has no extension, check if path + ".html" exists
                if path and not os.path.splitext(path)[1]:
                    html_path = f"{path}.html"
                    full_html_path = os.path.join(directory, html_path)
                    if os.path.isfile(full_html_path):
                        path = html_path
                try:
                    return await super().get_response(path, scope)
                except Exception:
                    # Fallback to index.html for SPA client-side routing
                    index_path = os.path.join(directory, "index.html")
                    if os.path.isfile(index_path):
                        return FileResponse(index_path)
                    raise
        
        app.mount("/", SPAStaticFiles(directory=ui_dir, html=True), name="ui")

    return app



app = create_app()
