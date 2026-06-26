"""
Delivery domain models — delivery boys, location tracking, attendance, wallets, settlements, cash collections.
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class DeliveryBoyStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    ON_LEAVE = "on_leave"


class AvailabilityStatus(str, enum.Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    ON_DELIVERY = "on_delivery"


class DeliveryBoy(BaseEntity):
    __tablename__ = "delivery_boys"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    vendor_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )

    # Status
    status: Mapped[DeliveryBoyStatus] = mapped_column(
        Enum(DeliveryBoyStatus, name="delivery_boy_status_enum"),
        nullable=False, default=DeliveryBoyStatus.ACTIVE,
    )
    availability: Mapped[AvailabilityStatus] = mapped_column(
        Enum(AvailabilityStatus, name="availability_status_enum"),
        nullable=False, default=AvailabilityStatus.OFFLINE,
    )

    # Vehicle info
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # bicycle, motorcycle, scooter
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Location
    current_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_location_update: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Stats
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Active orders
    current_order_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_concurrent_orders: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    __table_args__ = (
        Index("ix_delivery_boys_vendor_status", "vendor_id", "status", "availability"),
        Index("ix_delivery_boys_location", "current_latitude", "current_longitude"),
    )


class DeliveryLocation(BaseEntity):
    __tablename__ = "delivery_locations"

    delivery_boy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_boys.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    heading: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_delivery_locations_boy_time", "delivery_boy_id", "recorded_at"),
    )


class DeliveryAttendance(BaseEntity):
    __tablename__ = "delivery_attendances"

    delivery_boy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_boys.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    clock_in_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clock_in_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clock_out_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clock_out_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    __table_args__ = (
        Index("ix_delivery_attendance_boy_date", "delivery_boy_id", "clock_in"),
    )


class DeliveryWallet(BaseEntity):
    __tablename__ = "delivery_wallets"

    delivery_boy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_boys.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    pending_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    total_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    total_collected_cash: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    cash_in_hand: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)


class DeliverySettlement(BaseEntity):
    __tablename__ = "delivery_settlements"

    delivery_boy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_boys.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivery_earnings: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    tips: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    cash_collected: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    cash_deposited: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)

    __table_args__ = (
        Index("ix_delivery_settlements_boy_status", "delivery_boy_id", "status", "created_at"),
    )


class CashCollection(BaseEntity):
    __tablename__ = "cash_collections"

    delivery_boy_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("delivery_boys.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    deposited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deposited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deposit_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class VendorDeliveryLocation(BaseEntity):
    """GPS trail for vendor self-delivery orders — mirrors DeliveryLocation for delivery boys."""
    __tablename__ = "vendor_delivery_locations"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    heading: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_vendor_delivery_locations_vendor_time", "vendor_id", "recorded_at"),
        Index("ix_vendor_delivery_locations_order", "order_id", "recorded_at"),
    )
