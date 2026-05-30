"""
Support domain models — tickets, messages, disputes.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_CUSTOMER = "waiting_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class DisputeStatus(str, enum.Enum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    RESOLVED_CUSTOMER = "resolved_customer"
    RESOLVED_VENDOR = "resolved_vendor"
    ESCALATED = "escalated"
    CLOSED = "closed"


class SupportTicket(BaseEntity):
    __tablename__ = "support_tickets"

    ticket_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )
    assigned_to: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True,
    )

    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    # category: general, order, payment, delivery, account, vendor, other

    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"),
        nullable=False, default=TicketStatus.OPEN, index=True,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority_enum"),
        nullable=False, default=TicketPriority.MEDIUM,
    )

    # Related entity
    order_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Resolution
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Satisfaction
    satisfaction_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    satisfaction_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    messages: Mapped[List["SupportMessage"]] = relationship(back_populates="ticket", lazy="noload")

    __table_args__ = (
        Index("ix_tickets_user_status", "user_id", "status", "created_at"),
        Index("ix_tickets_assigned_status", "assigned_to", "status"),
    )


class SupportMessage(BaseEntity):
    __tablename__ = "support_messages"

    ticket_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    sender_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    attachments: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Internal notes
    message_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    # message_type: text, image, file, system

    ticket: Mapped["SupportTicket"] = relationship(back_populates="messages")

    __table_args__ = (
        Index("ix_support_messages_ticket", "ticket_id", "created_at"),
    )


class Dispute(BaseEntity):
    __tablename__ = "disputes"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id"),
        nullable=False, index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"),
        nullable=False, index=True,
    )
    assigned_to: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )

    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="quality")
    # category: quality, missing_items, wrong_items, delayed, damaged, other

    status: Mapped[DisputeStatus] = mapped_column(
        Enum(DisputeStatus, name="dispute_status_enum"),
        nullable=False, default=DisputeStatus.OPEN,
    )

    customer_evidence: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    vendor_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refund_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_disputes_status", "status", "created_at"),
    )
