"""
Catalog endpoints — customer-facing product browsing, search, filters.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, CategoryResponse, PaginatedResponse, PaginationMeta,
    ProductResponse,
)
from app.db.session import get_db
from app.models.product import Category, Inventory, Product, ProductPrice, ProductStatus
from app.models.vendor import Vendor, VendorStatus

router = APIRouter()


@router.get("/products", response_model=PaginatedResponse[ProductResponse])
async def browse_products(
    page: int = 1,
    page_size: int = 20,
    category_id: Optional[UUID] = None,
    vendor_id: Optional[UUID] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = None,
    search: Optional[str] = None,
    is_featured: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    """Browse products with filters, sorting, and pagination."""
    query = (
        select(Product)
        .options(selectinload(Product.variants), selectinload(Product.images), selectinload(Product.category))
        .where(Product.is_deleted == False, Product.status == ProductStatus.ACTIVE)
    )

    if category_id:
        query = query.where(Product.category_id == category_id)
    if is_featured:
        query = query.where(Product.is_featured == True)
    if search:
        query = query.where(
            (Product.name.ilike(f"%{search}%")) |
            (Product.description.ilike(f"%{search}%"))
        )

    # Count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Sorting
    if sort_by == "name_asc":
        query = query.order_by(Product.name.asc())
    elif sort_by == "name_desc":
        query = query.order_by(Product.name.desc())
    elif sort_by == "newest":
        query = query.order_by(Product.created_at.desc())
    else:
        query = query.order_by(Product.is_featured.desc(), Product.created_at.desc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Enrich products with database inventory price and stock details
    for p in products:
        p_attrs = dict(p.attributes or {})
        inv_query = select(Inventory).where(Inventory.product_id == p.id, Inventory.is_deleted == False)
        if vendor_id:
            inv_query = inv_query.where(Inventory.vendor_id == vendor_id)
        inv_res = await db.execute(inv_query)
        inv = inv_res.scalars().first()
        if inv:
            p_attrs["price"] = float(inv.unit_price)
            p_attrs["quantity"] = float(inv.quantity)
            p_attrs["vendor_id"] = str(inv.vendor_id)
        else:
            p_attrs["price"] = 30.0
            p_attrs["quantity"] = 0.0
            p_attrs["vendor_id"] = ""
        if "image_emoji" not in p_attrs:
            p_attrs["image_emoji"] = "🥬"
        p.attributes = p_attrs

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        data=[ProductResponse.model_validate(p) for p in products],
        pagination=PaginationMeta(page=page, page_size=page_size, total_items=total, total_pages=total_pages, has_next=page < total_pages, has_previous=page > 1),
    )


@router.get("/categories", response_model=APIResponse[List[CategoryResponse]])
async def list_categories(
    parent_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """List categories, optionally filtered by parent."""
    query = select(Category).where(Category.is_deleted == False, Category.is_active == True)
    if parent_id:
        query = query.where(Category.parent_id == parent_id)
    else:
        query = query.where(Category.parent_id == None)

    query = query.order_by(Category.sort_order)
    result = await db.execute(query)
    categories = result.scalars().all()

    return APIResponse(success=True, data=[CategoryResponse.model_validate(c) for c in categories])


@router.get("/vendors/nearby")
async def find_nearby_vendors(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Find vendors near a location using Haversine formula."""
    from app.models.vendor import VendorStore
    import math

    rad_lat = math.radians(latitude)
    rad_lon = math.radians(longitude)

    # Correct database-level Haversine distance formula using VendorStore fields
    distance_expr = func.acos(
        func.cos(rad_lat) *
        func.cos(func.radians(VendorStore.latitude)) *
        func.cos(func.radians(VendorStore.longitude) - rad_lon) +
        func.sin(rad_lat) *
        func.sin(func.radians(VendorStore.latitude))
    ) * 6371.0

    # Build query
    query = (
        select(Vendor)
        .join(VendorStore, VendorStore.vendor_id == Vendor.id)
        .where(
            Vendor.is_deleted == False,
            Vendor.status == VendorStatus.APPROVED,
            VendorStore.latitude.isnot(None),
            VendorStore.longitude.isnot(None),
            distance_expr <= radius_km
        )
        .order_by(distance_expr.asc(), Vendor.average_rating.desc())
    )

    # Fetch total count
    count_query = (
        select(func.count(Vendor.id))
        .join(VendorStore, VendorStore.vendor_id == Vendor.id)
        .where(
            Vendor.is_deleted == False,
            Vendor.status == VendorStatus.APPROVED,
            VendorStore.latitude.isnot(None),
            VendorStore.longitude.isnot(None),
            distance_expr <= radius_km
        )
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Execute paginated query
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    vendors = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    from app.api.schemas import VendorResponse
    return PaginatedResponse(
        data=[VendorResponse.model_validate(v) for v in vendors],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        ),
    )
