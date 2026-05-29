"""
Storage domain models — file metadata for the local object storage service.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class FileMetadata(BaseEntity):
    __tablename__ = "file_metadata"

    # Owner
    owner_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True,
    )
    vendor_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True, index=True,
    )

    # File info
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False, index=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, default="application/octet-stream")
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False, default="")

    # Storage
    storage_bucket: Mapped[str] = mapped_column(String(50), nullable=False, default="public")
    # bucket: public, private, temp, archive
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    encryption_key_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Thumbnails
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    thumbnail_small_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    thumbnail_medium_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Image metadata
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Checksum
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Versioning
    file_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_version_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True)

    # Access
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Expiry
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    custom_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Usage context
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # entity_type: product_image, vendor_logo, kyc_doc, invoice, avatar, review_image
    entity_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_file_metadata_owner", "owner_id", "storage_bucket"),
        Index("ix_file_metadata_vendor", "vendor_id", "storage_bucket"),
        Index("ix_file_metadata_entity", "entity_type", "entity_id"),
        Index("ix_file_metadata_expires", "expires_at"),
    )
