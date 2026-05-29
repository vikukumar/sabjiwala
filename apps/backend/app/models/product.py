"""
Product/Catalog domain models — categories, products, variants, pricing, inventory, reviews, wishlists.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, Numeric,
    String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class ProductUnit(str, enum.Enum):
    KG = "kg"
    GRAM = "gram"
    PIECE = "piece"
    DOZEN = "dozen"
    BUNCH = "bunch"
    PACKET = "packet"
    LITRE = "litre"
    ML = "ml"


class ProductStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    OUT_OF_STOCK = "out_of_stock"


class Category(BaseEntity):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Hierarchy (MPTT / Adjacency List)
    parent_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("categories.id"), nullable=True, index=True,
    )
    level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # SEO
    meta_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    parent: Mapped[Optional["Category"]] = relationship(remote_side="Category.id", lazy="selectin")
    children: Mapped[List["Category"]] = relationship(back_populates="parent", lazy="noload")
    products: Mapped[List["Product"]] = relationship(back_populates="category", lazy="noload")

    __table_args__ = (
        Index("ix_categories_parent_sort", "parent_id", "sort_order"),
        Index("ix_categories_active_level", "is_active", "level"),
    )


class Product(BaseEntity):
    __tablename__ = "products"

    # Base info
    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    short_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Category
    category_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("categories.id"),
        nullable=False, index=True,
    )

    # Unit
    unit: Mapped[ProductUnit] = mapped_column(
        Enum(ProductUnit, name="product_unit_enum"),
        nullable=False, default=ProductUnit.KG,
    )
    unit_value: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Images
    primary_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Status
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status_enum"),
        nullable=False, default=ProductStatus.DRAFT, index=True,
    )
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Attributes (JSON: {color: "green", organic: true, ...})
    attributes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)

    # Tags
    tags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    # SEO
    meta_title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Full-text search vector
    search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR, nullable=True)

    # Relationships
    category: Mapped["Category"] = relationship(back_populates="products", lazy="selectin")
    variants: Mapped[List["ProductVariant"]] = relationship(back_populates="product", lazy="selectin")
    images: Mapped[List["ProductImage"]] = relationship(back_populates="product", lazy="selectin")
    prices: Mapped[List["ProductPrice"]] = relationship(back_populates="product", lazy="noload")
    reviews: Mapped[List["ProductReview"]] = relationship(back_populates="product", lazy="noload")

    __table_args__ = (
        Index("ix_products_category_status", "category_id", "status", "is_deleted"),
        Index("ix_products_featured", "is_featured", "status"),
    )


class ProductVariant(BaseEntity):
    __tablename__ = "product_variants"

    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g., "500g", "1kg", "2kg"
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True)
    unit_value: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    unit: Mapped[ProductUnit] = mapped_column(
        Enum(ProductUnit, name="product_unit_enum", create_constraint=False),
        nullable=False, default=ProductUnit.KG,
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="variants")

    __table_args__ = (
        Index("ix_product_variants_product_sort", "product_id", "sort_order"),
    )


class ProductImage(BaseEntity):
    __tablename__ = "product_images"

    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    alt_text: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="images")


class ProductPrice(BaseEntity):
    __tablename__ = "product_prices"

    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    variant_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    compare_at_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)  # MRP/original
    cost_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(5), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="prices")

    __table_args__ = (
        UniqueConstraint("product_id", "variant_id", "vendor_id", name="uq_product_variant_vendor_price"),
        Index("ix_product_prices_vendor", "vendor_id", "is_active"),
    )


class Inventory(BaseEntity):
    __tablename__ = "inventorys"

    __tablename__ = "inventory"

    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    variant_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("product_variants.id"), nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reserved_quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    low_stock_threshold: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    is_in_stock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_unlimited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("product_id", "variant_id", "vendor_id", name="uq_inventory_product_variant_vendor"),
        Index("ix_inventory_vendor_stock", "vendor_id", "is_in_stock"),
        Index("ix_inventory_low_stock", "vendor_id", "quantity", "low_stock_threshold"),
    )


class InventoryLog(BaseEntity):
    __tablename__ = "inventory_logs"

    inventory_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("inventory.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True,
    )
    change_type: Mapped[str] = mapped_column(String(50), nullable=False)  # add, remove, reserve, release, adjustment
    quantity_change: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_before: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_after: Mapped[float] = mapped_column(Float, nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # order, import, manual
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_inventory_logs_inventory_type", "inventory_id", "change_type", "created_at"),
    )


class Wishlist(BaseEntity):
    __tablename__ = "wishlists"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),
    )


class ProductReview(BaseEntity):
    __tablename__ = "product_reviews"

    product_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), nullable=True,
    )
    vendor_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False, index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    images: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Vendor reply
    vendor_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vendor_replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("product_id", "user_id", "order_id", name="uq_review_product_user_order"),
        Index("ix_reviews_product_approved", "product_id", "is_approved", "rating"),
    )
