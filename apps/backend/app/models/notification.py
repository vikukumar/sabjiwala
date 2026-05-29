"""
Notification domain models — notifications, templates, push subscriptions, email/SMS queues.
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class NotificationType(str, enum.Enum):
    ORDER_UPDATE = "order_update"
    DELIVERY_UPDATE = "delivery_update"
    PAYMENT = "payment"
    PROMOTION = "promotion"
    SYSTEM = "system"
    SUPPORT = "support"
    REFERRAL = "referral"
    VENDOR = "vendor"


class NotificationChannel(str, enum.Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"


class QueueStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class Notification(BaseEntity):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type_enum"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read", "created_at"),
        Index("ix_notifications_type", "notification_type", "created_at"),
    )


class NotificationTemplate(BaseEntity):
    __tablename__ = "notification_templates"

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    event_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Templates per channel
    email_subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # HTML with Jinja2 vars
    sms_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    push_title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    push_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    whatsapp_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    in_app_title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    in_app_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Enabled channels
    channels: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    # Variables schema
    variables: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PushSubscription(BaseEntity):
    __tablename__ = "push_subscriptions"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    device_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_push_subs_user_active", "user_id", "is_active"),
    )


class EmailQueue(BaseEntity):
    __tablename__ = "email_queues"

    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    to_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    from_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    from_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reply_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[QueueStatus] = mapped_column(
        Enum(QueueStatus, name="queue_status_enum"),
        nullable=False, default=QueueStatus.PENDING, index=True,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Reference
    template_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_email_queue_status", "status", "created_at"),
    )


class SmsQueue(BaseEntity):
    __tablename__ = "sms_queues"

    to_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    template_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    variables: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    status: Mapped[QueueStatus] = mapped_column(
        Enum(QueueStatus, name="queue_status_enum", create_constraint=False),
        nullable=False, default=QueueStatus.PENDING, index=True,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    provider_response: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_sms_queue_status", "status", "created_at"),
    )
