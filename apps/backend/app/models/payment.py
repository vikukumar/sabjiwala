"""
Payment domain models — payments, wallets, wallet transactions, settlements.
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"
    CANCELLED = "cancelled"


class PaymentGateway(str, enum.Enum):
    RAZORPAY = "razorpay"
    PHONEPE = "phonepe"
    CASHFREE = "cashfree"
    COD = "cod"
    WALLET = "wallet"


class WalletType(str, enum.Enum):
    CUSTOMER = "customer"
    VENDOR = "vendor"
    DELIVERY = "delivery"


class WalletTransactionType(str, enum.Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    REFUND = "refund"
    REWARD = "reward"
    REFERRAL = "referral"
    CASHBACK = "cashback"
    PAYOUT = "payout"
    TOP_UP = "top_up"
    SETTLEMENT = "settlement"


class Payment(BaseEntity):
    __tablename__ = "payments"

    order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Payment details
    gateway: Mapped[PaymentGateway] = mapped_column(
        Enum(PaymentGateway, name="payment_gateway_enum"),
        nullable=False,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum"),
        nullable=False, default=PaymentStatus.PENDING, index=True,
    )

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(5), nullable=False, default="INR")

    # Gateway-specific IDs
    gateway_order_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    gateway_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    gateway_signature: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Method info
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # upi, card, netbanking, wallet, cod
    method_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Card last 4, UPI ID etc

    # Refund tracking
    refunded_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    gateway_refund_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Metadata
    gateway_response: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_payments_gateway_order", "gateway", "gateway_order_id"),
        Index("ix_payments_user_status", "user_id", "status", "created_at"),
    )


class RazorpayOrder(BaseEntity):
    __tablename__ = "razorpay_orders"

    payment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    razorpay_order_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    razorpay_signature: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # Amount in paise
    currency: Mapped[str] = mapped_column(String(5), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="created")
    receipt: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    response_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class PhonepeTransaction(BaseEntity):
    __tablename__ = "phonepe_transactions"

    payment_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    merchant_transaction_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    phonepe_transaction_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # Amount in paise
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="INITIATED")
    payment_instrument_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    redirect_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    callback_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class Wallet(BaseEntity):
    __tablename__ = "wallets"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    wallet_type: Mapped[WalletType] = mapped_column(
        Enum(WalletType, name="wallet_type_enum"),
        nullable=False, default=WalletType.CUSTOMER,
    )
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    pending_balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    total_credited: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    total_debited: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class WalletTransaction(BaseEntity):
    __tablename__ = "wallet_transactions"

    wallet_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transaction_type: Mapped[WalletTransactionType] = mapped_column(
        Enum(WalletTransactionType, name="wallet_txn_type_enum"),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    balance_before: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # order, refund, payout, top_up
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_wallet_txn_wallet_type", "wallet_id", "transaction_type", "created_at"),
        Index("ix_wallet_txn_user", "user_id", "created_at"),
    )


class Settlement(BaseEntity):
    __tablename__ = "settlements"

    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    delivery_charges: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    refund_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")  # pending, processing, completed, failed
    payout_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Order details
    order_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_settlements_vendor_status", "vendor_id", "status", "created_at"),
    )
