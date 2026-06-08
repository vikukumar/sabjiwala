"""
Vendor domain models — vendor profiles, stores, documents, service areas, staff, wallets, payouts.
"""
import enum
from datetime import datetime, time, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, Time, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class VendorStatus(str, enum.Enum):
    PENDING = "pending"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"


class DocumentType(str, enum.Enum):
    GST_CERTIFICATE = "gst_certificate"
    PAN_CARD = "pan_card"
    AADHAAR_CARD = "aadhaar_card"
    BANK_PASSBOOK = "bank_passbook"
    CANCELLED_CHEQUE = "cancelled_cheque"
    FSSAI_LICENSE = "fssai_license"
    SHOP_LICENSE = "shop_license"
    OTHER = "other"


class DocumentVerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Vendor(BaseEntity):
    __tablename__ = "vendors"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    business_name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    business_type: Mapped[str] = mapped_column(String(100), nullable=False, default="individual")
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    banner_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Status
    status: Mapped[VendorStatus] = mapped_column(
        Enum(VendorStatus, name="vendor_status_enum"),
        nullable=False, default=VendorStatus.PENDING, index=True,
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Business details
    gst_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    fssai_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Commission
    commission_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Contact
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    whatsapp_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Rating
    average_rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_ratings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_orders: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Settings
    auto_accept_orders: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    store: Mapped[Optional["VendorStore"]] = relationship(back_populates="vendor", uselist=False, lazy="selectin")
    documents: Mapped[List["VendorDocument"]] = relationship(back_populates="vendor", lazy="selectin")
    service_areas: Mapped[List["VendorServiceArea"]] = relationship(back_populates="vendor", lazy="noload")
    delivery_rules: Mapped[List["VendorDeliveryRule"]] = relationship(back_populates="vendor", lazy="noload")
    bank_accounts: Mapped[List["VendorBankAccount"]] = relationship(back_populates="vendor", lazy="noload")
    staff: Mapped[List["VendorStaff"]] = relationship(back_populates="vendor", lazy="noload")

    __table_args__ = (
        Index("ix_vendors_status_active", "status", "is_deleted"),
    )


class VendorStore(BaseEntity):
    __tablename__ = "vendor_stores"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    store_name: Mapped[str] = mapped_column(String(300), nullable=False)
    address_line_1: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    address_line_2: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timings (JSON: {day: {open: "09:00", close: "21:00", is_closed: false}})
    store_timings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Prep time
    preparation_time_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    vendor: Mapped["Vendor"] = relationship(back_populates="store")
    holidays: Mapped[List["VendorHoliday"]] = relationship(back_populates="store", lazy="selectin")

    __table_args__ = (
        Index("ix_vendor_stores_latlon", "latitude", "longitude"),
    )


class VendorHoliday(BaseEntity):
    __tablename__ = "vendor_holidays"

    store_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendor_stores.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_full_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    store: Mapped["VendorStore"] = relationship(back_populates="holidays")


class VendorDocument(BaseEntity):
    __tablename__ = "vendor_documents"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type_enum"),
        nullable=False,
    )
    document_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    verification_status: Mapped[DocumentVerificationStatus] = mapped_column(
        Enum(DocumentVerificationStatus, name="doc_verification_status_enum"),
        nullable=False, default=DocumentVerificationStatus.PENDING,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    vendor: Mapped["Vendor"] = relationship(back_populates="documents")


class VendorServiceArea(BaseEntity):
    __tablename__ = "vendor_service_areas"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Default")

    # Radius-based (simple circle)
    radius_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    center_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    center_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Polygon-based (GeoJSON stored as JSONB for compatibility without PostGIS)
    polygon_geojson: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    vendor: Mapped["Vendor"] = relationship(back_populates="service_areas")


class VendorDeliveryRule(BaseEntity):
    __tablename__ = "vendor_delivery_rules"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    min_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    free_delivery_above: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    base_delivery_charge: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    per_km_charge: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    max_delivery_distance_km: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    packaging_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)

    # Distance slabs (JSON: [{from_km: 0, to_km: 3, charge: 20}, ...])
    distance_slabs: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    vendor: Mapped["Vendor"] = relationship(back_populates="delivery_rules")


class VendorBankAccount(BaseEntity):
    __tablename__ = "vendor_bank_accounts"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    account_holder_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    account_number: Mapped[str] = mapped_column(String(50), nullable=False, default="")  # Encrypted
    ifsc_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    account_type: Mapped[str] = mapped_column(String(20), nullable=False, default="savings")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    vendor: Mapped["Vendor"] = relationship(back_populates="bank_accounts")


class VendorStaff(BaseEntity):
    __tablename__ = "vendor_staffs"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True,
    )
    designation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    permissions_override: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    vendor: Mapped["Vendor"] = relationship(back_populates="staff")

    __table_args__ = (
        UniqueConstraint("vendor_id", "user_id", name="uq_vendor_staff"),
    )


class VendorWallet(BaseEntity):
    __tablename__ = "vendor_wallets"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    pending_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    total_earned: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    total_withdrawn: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)


class VendorPayout(BaseEntity):
    __tablename__ = "vendor_payouts"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    bank_account_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendor_bank_accounts.id", ondelete="SET NULL"), nullable=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, processing, completed, failed
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_vendor_payouts_status", "vendor_id", "status", "created_at"),
    )
