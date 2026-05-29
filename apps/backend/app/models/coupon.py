"""
Coupon & Offer domain models — coupons, rules, usage, offers, referrals.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class CouponType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"
    FREE_DELIVERY = "free_delivery"
    BUY_X_GET_Y = "buy_x_get_y"
    REFERRAL = "referral"


class CouponScope(str, enum.Enum):
    PLATFORM = "platform"  # Admin-created, platform-wide
    VENDOR = "vendor"  # Vendor-created, vendor-specific


class OfferType(str, enum.Enum):
    FLASH_SALE = "flash_sale"
    FESTIVAL = "festival"
    STORE = "store"
    CATEGORY = "category"
    PRODUCT = "product"


class Coupon(BaseEntity):
    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Type
    coupon_type: Mapped[CouponType] = mapped_column(
        Enum(CouponType, name="coupon_type_enum"),
        nullable=False, index=True,
    )
    scope: Mapped[CouponScope] = mapped_column(
        Enum(CouponScope, name="coupon_scope_enum"),
        nullable=False, default=CouponScope.PLATFORM,
    )

    # Discount values
    discount_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_discount_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    min_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)

    # Buy X Get Y
    buy_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    get_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    free_product_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Usage limits
    max_total_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_uses_per_user: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Validity
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Vendor (for vendor-scoped coupons)
    vendor_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True,
    )

    # Relationships
    rules: Mapped[List["CouponRule"]] = relationship(back_populates="coupon", lazy="selectin")

    __table_args__ = (
        Index("ix_coupons_active_dates", "is_active", "starts_at", "expires_at"),
    )


class CouponRule(BaseEntity):
    __tablename__ = "coupon_rules"

    coupon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("coupons.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Rule types: geo_restriction, category_restriction, product_restriction,
    #             user_type_restriction, first_order_only, payment_method

    # Rule data (flexible JSON)
    # Examples:
    #   geo: {"cities": ["Mumbai", "Delhi"], "states": ["Maharashtra"]}
    #   category: {"category_ids": ["uuid1", "uuid2"], "mode": "include"}
    #   product: {"product_ids": ["uuid1"], "mode": "exclude"}
    #   user: {"user_types": ["customer"], "first_order_only": true}
    #   payment: {"methods": ["razorpay", "phonepe"]}
    rule_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    coupon: Mapped["Coupon"] = relationship(back_populates="rules")


class CouponUsage(BaseEntity):
    __tablename__ = "coupon_usages"

    coupon_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("coupons.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )
    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id"),
        nullable=False, index=True,
    )
    discount_applied: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    __table_args__ = (
        Index("ix_coupon_usage_user", "coupon_id", "user_id"),
    )


class Offer(BaseEntity):
    __tablename__ = "offers"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    offer_type: Mapped[OfferType] = mapped_column(
        Enum(OfferType, name="offer_type_enum"),
        nullable=False, index=True,
    )

    # Discount
    discount_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    discount_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    max_discount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    # Scope
    vendor_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True,
    )
    category_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("categories.id"), nullable=True,
    )

    # Stacking rules
    is_stackable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Validity
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Display
    banner_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    badge_text: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    offer_products: Mapped[List["OfferProduct"]] = relationship(back_populates="offer", lazy="selectin")

    __table_args__ = (
        Index("ix_offers_active_dates", "is_active", "starts_at", "expires_at"),
        Index("ix_offers_type_vendor", "offer_type", "vendor_id"),
    )


class OfferProduct(BaseEntity):
    __tablename__ = "offer_products"

    offer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("offers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id"),
        nullable=False, index=True,
    )
    offer_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    discount_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_quantity_per_user: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    offer: Mapped["Offer"] = relationship(back_populates="offer_products")

    __table_args__ = (
        UniqueConstraint("offer_id", "product_id", name="uq_offer_product"),
    )


class ReferralCode(BaseEntity):
    __tablename__ = "referral_codes"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    total_referrals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earnings: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ReferralReward(BaseEntity):
    __tablename__ = "referral_rewards"

    referrer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )
    referred_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )
    referral_code_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("referral_codes.id"),
        nullable=False,
    )
    referrer_reward: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    referred_reward: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, credited, expired
    order_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    credited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
