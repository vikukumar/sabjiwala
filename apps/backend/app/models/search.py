"""
Search domain models — full-text search index and geo cache.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    DateTime, Float, Index, Integer, String, Text, text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseEntity


class SearchIndex(BaseEntity):
    __tablename__ = "search_index"

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # entity_type: product, vendor, category
    entity_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR, nullable=True)

    # Location (for geo search)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Ranking
    boost: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Additional data for search results
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    last_indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_search_entity", "entity_type", "entity_id"),
        Index("ix_search_location", "latitude", "longitude"),
    )


class GeoCache(BaseEntity):
    __tablename__ = "geo_caches"

    query: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    query_type: Mapped[str] = mapped_column(String(20), nullable=False, default="forward")
    # query_type: forward (address→coords), reverse (coords→address)

    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    formatted_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    place_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    response_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_geo_cache_query_type", "query", "query_type"),
    )
