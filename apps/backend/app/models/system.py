"""
System domain models — settings, installation state.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class SystemSetting(BaseEntity):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False, default="string")
    # value_type: string, integer, boolean, json, float
    group: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    # group: general, payment, delivery, notification, appearance, seo, security
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_editable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class InstallationState(BaseEntity):
    __tablename__ = "installation_states"

    step: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # Steps: database, admin_account, platform_config, branding, notification, payment, complete
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
