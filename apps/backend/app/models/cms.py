"""
CMS domain models — pages, banners, advertisements, email/SMS templates.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class CmsPage(BaseEntity):
    __tablename__ = "cms_pages"

    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meta_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    page_type: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    # page_type: privacy_policy, terms, about, faq, refund_policy, custom
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Banner(BaseEntity):
    __tablename__ = "banners"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    mobile_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    action_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # action_type: url, category, product, vendor, offer

    # Targeting
    target_audience: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # all, customer, vendor
    target_location: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Display
    position: Mapped[str] = mapped_column(String(50), nullable=False, default="home_top")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Stats
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_banners_position_active", "position", "is_active", "sort_order"),
    )


class Advertisement(BaseEntity):
    __tablename__ = "advertisements"

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    advertiser_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Creative
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    click_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Placement
    placement: Mapped[str] = mapped_column(String(50), nullable=False, default="sidebar")
    # placement: sidebar, inline, popup, banner, pip
    page_target: Mapped[str] = mapped_column(String(100), nullable=False, default="home")
    position: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Targeting
    target_categories: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    target_locations: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # Budget
    daily_budget: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_budget: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_per_click: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_per_impression: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Stats
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_spent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Schedule
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_ads_placement_active", "placement", "is_active"),
    )


class EmailTemplate(BaseEntity):
    __tablename__ = "email_templates"

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variables: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="transactional")
    # category: transactional, marketing, system


class SmsTemplate(BaseEntity):
    __tablename__ = "sms_templates"

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    provider_template_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    variables: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="transactional")
