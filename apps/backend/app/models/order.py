"""
Order domain models — carts, orders, order items, status history, split orders, returns, refunds, invoices.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ACCEPTED = "accepted"
    PACKED = "packed"
    ASSIGNED = "assigned"
    PICKED = "picked"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    RETURNED = "returned"
    PARTIAL_REFUND = "partial_refund"
    FAILED = "failed"


class ReturnStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    PICKED_UP = "picked_up"
    RECEIVED = "received"
    REFUNDED = "refunded"
    CLOSED = "closed"


class RefundStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Cart(BaseEntity):
    __tablename__ = "carts"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    coupon_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    items: Mapped[List["CartItem"]] = relationship(back_populates="cart", lazy="selectin")

    __table_args__ = (
        Index("ix_carts_user_vendor", "user_id", "vendor_id", "is_deleted"),
    )


class CartItem(BaseEntity):
    __tablename__ = "cart_items"

    cart_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("carts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)

    cart: Mapped["Cart"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("cart_id", "product_id", "variant_id", "vendor_id", name="uq_cart_item"),
    )


class Order(BaseEntity):
    __tablename__ = "orders"

    # Order number (human-readable, auto-generated)
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Customer
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Vendor
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Status
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status_enum"),
        nullable=False, default=OrderStatus.PENDING, index=True,
    )

    # Delivery address (snapshot at order time)
    delivery_address: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    delivery_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    delivery_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Amounts
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    delivery_charge: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    coupon_discount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    wallet_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    packaging_charge: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)

    # Coupon
    coupon_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    coupon_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Payment
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="cod")
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    payment_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Delivery
    delivery_boy_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    estimated_delivery_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_delivery_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_otp: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    delivery_distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Split order reference
    parent_order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=True, index=True,
    )
    is_split_order: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Notes
    customer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vendor_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cancellation
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    items: Mapped[List["OrderItem"]] = relationship(back_populates="order", lazy="selectin")
    status_history: Mapped[List["OrderStatusHistory"]] = relationship(back_populates="order", lazy="noload")

    __table_args__ = (
        Index("ix_orders_user_status", "user_id", "status", "created_at"),
        Index("ix_orders_vendor_status", "vendor_id", "status", "created_at"),
        Index("ix_orders_delivery_boy", "delivery_boy_id", "status"),
        Index("ix_orders_created", "created_at"),
    )


class OrderItem(BaseEntity):
    __tablename__ = "order_items"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Snapshot at order time
    product_name: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    variant_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="kg")

    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="items")


class OrderStatusHistory(BaseEntity):
    __tablename__ = "order_status_historys"

    __tablename__ = "order_status_history"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    changed_by_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # customer, vendor, delivery, admin, system
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="status_history")

    __table_args__ = (
        Index("ix_order_status_history_order", "order_id", "created_at"),
    )


class ReturnRequest(BaseEntity):
    __tablename__ = "return_requests"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status: Mapped[ReturnStatus] = mapped_column(
        Enum(ReturnStatus, name="return_status_enum"),
        nullable=False, default=ReturnStatus.REQUESTED,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    images: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    refund_amount: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Items being returned
    return_items: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)


class Refund(BaseEntity):
    __tablename__ = "refunds"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    return_request_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("return_requests.id", ondelete="CASCADE"), nullable=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[RefundStatus] = mapped_column(
        Enum(RefundStatus, name="refund_status_enum"),
        nullable=False, default=RefundStatus.PENDING,
    )
    refund_method: Mapped[str] = mapped_column(String(50), nullable=False, default="wallet")  # wallet, original, bank
    gateway_refund_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_refunds_order_status", "order_id", "status"),
    )


class Invoice(BaseEntity):
    __tablename__ = "invoices"

    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Amounts
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    delivery_charge: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    packaging_charge: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Snapshot data
    billing_address: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    vendor_details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    items: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # PDF
    pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
