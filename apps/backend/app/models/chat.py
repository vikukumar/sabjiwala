"""
Live Chat and FAQ models for Customer Support.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, Index
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class ChatSessionStatus(str, enum.Enum):
    WAITING = "waiting"    # Waiting for agent assignment
    ACTIVE = "active"      # Agent is actively chatting
    BOT = "bot"            # Bot is handling the chat
    CLOSED = "closed"      # Chat is finished


class ChatMessageSender(str, enum.Enum):
    CUSTOMER = "customer"
    AGENT = "agent"
    BOT = "bot"


class LiveChatSession(BaseEntity):
    __tablename__ = "live_chat_sessions"

    customer_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True, index=True
    )
    guest_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    
    agent_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    
    status: Mapped[ChatSessionStatus] = mapped_column(
        Enum(ChatSessionStatus, name="chat_session_status_enum"),
        nullable=False, default=ChatSessionStatus.WAITING, index=True
    )

    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Metadata for browser info, IP, etc.
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    messages: Mapped[List["LiveChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", lazy="noload"
    )

    __table_args__ = (
        Index("ix_chat_sessions_status_agent", "status", "agent_id"),
    )


class LiveChatMessage(BaseEntity):
    __tablename__ = "live_chat_messages"

    session_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("live_chat_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    
    sender_type: Mapped[ChatMessageSender] = mapped_column(
        Enum(ChatMessageSender, name="chat_message_sender_enum"),
        nullable=False
    )
    
    sender_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # UUID of user/agent or 'bot'
    
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Optional attachments or rich media
    attachments: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    session: Mapped["LiveChatSession"] = relationship(back_populates="messages")


class FAQCategory(BaseEntity):
    __tablename__ = "faq_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    faqs: Mapped[List["FAQ"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", lazy="selectin"
    )


class FAQ(BaseEntity):
    __tablename__ = "faqs"

    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("faq_categories.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["FAQCategory"] = relationship(back_populates="faqs")
