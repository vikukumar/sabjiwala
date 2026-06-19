"""
Catalog endpoints — customer-facing product browsing, search, filters.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, CategoryResponse, PaginatedResponse, PaginationMeta,
    ProductResponse,
)
from app.db.session import get_db
from app.models.product import Category, Inventory, Product, ProductPrice, ProductStatus
from app.models.vendor import Vendor, VendorStatus, VendorStore, VendorServiceArea

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

    if vendor_id:
        query = query.join(Inventory, Inventory.product_id == Product.id).where(
            Inventory.vendor_id == vendor_id,
            Inventory.is_deleted == False
        )

    if category_id:
        # Get category and all its children subcategories
        cat_tree_query = select(Category).where(
            (Category.id == category_id) | (Category.parent_id == category_id),
            Category.is_deleted == False
        )
        cat_tree_res = await db.execute(cat_tree_query)
        cat_ids = [c.id for c in cat_tree_res.scalars().all()]
        if cat_ids:
            query = query.where(Product.category_id.in_(cat_ids))
        else:
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
        
        # Get inventory entry
        inv_query = select(Inventory).where(Inventory.product_id == p.id, Inventory.is_deleted == False)
        if vendor_id:
            inv_query = inv_query.where(Inventory.vendor_id == vendor_id)
        inv_res = await db.execute(inv_query)
        inv = inv_res.scalars().first()
        
        # Get product price entry
        price_query = select(ProductPrice).where(
            ProductPrice.product_id == p.id,
            ProductPrice.is_active == True
        )
        if vendor_id:
            price_query = price_query.where(ProductPrice.vendor_id == vendor_id)
        elif inv:
            price_query = price_query.where(ProductPrice.vendor_id == inv.vendor_id)
            
        price_res = await db.execute(price_query)
        price_obj = price_res.scalars().first()
        
        p_attrs["price"] = float(price_obj.price) if price_obj else 30.0
        
        if inv:
            p_attrs["quantity"] = float(inv.quantity)
            p_attrs["vendor_id"] = str(inv.vendor_id)
            from app.models.vendor import VendorStore, VendorServiceArea
            store_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == inv.vendor_id))
            store = store_res.scalars().first()
            
            area_res = await db.execute(
                select(VendorServiceArea)
                .where(VendorServiceArea.vendor_id == inv.vendor_id, VendorServiceArea.is_active == True, VendorServiceArea.is_deleted == False)
            )
            area = area_res.scalars().first()
            vendor_radius = float(area.radius_km) if (area and area.radius_km is not None) else 10.0
            
            if area and area.center_latitude is not None and area.center_longitude is not None:
                p_attrs["vendor_latitude"] = area.center_latitude
                p_attrs["vendor_longitude"] = area.center_longitude
                p_attrs["vendor_radius_km"] = vendor_radius
            elif store and store.latitude is not None and store.longitude is not None:
                p_attrs["vendor_latitude"] = store.latitude
                p_attrs["vendor_longitude"] = store.longitude
                p_attrs["vendor_radius_km"] = vendor_radius
            else:
                p_attrs["vendor_latitude"] = 19.0760
                p_attrs["vendor_longitude"] = 72.8777
                p_attrs["vendor_radius_km"] = 10.0
        else:
            p_attrs["quantity"] = 0.0
            p_attrs["vendor_id"] = ""
            p_attrs["vendor_latitude"] = 19.0760
            p_attrs["vendor_longitude"] = 72.8777
            p_attrs["vendor_radius_km"] = 10.0
            
        if "image_emoji" not in p_attrs:
            p_attrs["image_emoji"] = "🥬"
        p.attributes = p_attrs

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        data=[ProductResponse.model_validate(p) for p in products],
        pagination=PaginationMeta(page=page, page_size=page_size, total_items=total, total_pages=total_pages, has_next=page < total_pages, has_previous=page > 1),
    )


@router.get("/categories", response_model=APIResponse[List[CategoryResponse]])
async def list_categories(
    parent_id: Optional[UUID] = None,
    all_levels: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """List categories, optionally filtered by parent, or all levels."""
    query = select(Category).where(Category.is_deleted == False, Category.is_active == True)
    if not all_levels:
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


@router.get("/banners", response_model=APIResponse)
async def get_active_banners(
    position: str = "home_top",
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active banners filtered by position."""
    from app.models.cms import Banner
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    stmt = (
        select(Banner)
        .where(
            Banner.is_active == True,
            Banner.position == position,
            (Banner.starts_at == None) | (Banner.starts_at <= now),
            (Banner.expires_at == None) | (Banner.expires_at >= now)
        )
        .order_by(Banner.sort_order.asc())
    )
    res = await db.execute(stmt)
    banners = res.scalars().all()
    
    data = [
        {
            "id": str(b.id),
            "title": b.title,
            "subtitle": b.subtitle,
            "image_url": b.image_url,
            "mobile_image_url": b.mobile_image_url,
            "action_url": b.action_url,
            "action_type": b.action_type,
            "position": b.position,
        }
        for b in banners
    ]
    return APIResponse(success=True, data=data)


@router.get("/vendors/range-check", response_model=APIResponse)
async def range_check(
    latitude: float,
    longitude: float,
    db: AsyncSession = Depends(get_db),
):
    """
    Check if a given latitude and longitude is within the service area of ANY approved vendor.
    """
    from app.services.map_service import MapService
    map_service = MapService()

    # Get all active approved vendors
    stmt = (
        select(Vendor)
        .options(selectinload(Vendor.store), selectinload(Vendor.service_areas))
        .where(Vendor.status == VendorStatus.APPROVED, Vendor.is_deleted == False)
    )
    res = await db.execute(stmt)
    vendors = res.scalars().all()

    covered_vendor_ids = []
    in_range = False

    for vendor in vendors:
        # Check service areas first
        has_matched_service_area = False
        service_areas = [sa for sa in vendor.service_areas if sa.is_active and not sa.is_deleted]
        
        if service_areas:
            for sa in service_areas:
                if sa.center_latitude is not None and sa.center_longitude is not None and sa.radius_km is not None:
                    dist = map_service.calculate_haversine_distance(
                        latitude, longitude, sa.center_latitude, sa.center_longitude
                    )
                    if dist <= sa.radius_km:
                        has_matched_service_area = True
                        break
        else:
            # Fallback to store coordinates and check default 10km radius
            if vendor.store and vendor.store.latitude is not None and vendor.store.longitude is not None:
                dist = map_service.calculate_haversine_distance(
                    latitude, longitude, vendor.store.latitude, vendor.store.longitude
                )
                if dist <= 10.0:  # Default to 10km range if no service area is registered
                    has_matched_service_area = True

        if has_matched_service_area:
            in_range = True
            covered_vendor_ids.append(str(vendor.id))

    return APIResponse(
        success=True,
        data={
            "in_range": in_range,
            "covered_vendor_ids": covered_vendor_ids
        }
    )


@router.get("/products/{product_id}", response_model=APIResponse[ProductResponse])
async def get_catalog_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get single product details enriched with vendor price and stock for catalog browsing."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.variants), selectinload(Product.images), selectinload(Product.category))
        .where(Product.id == product_id, Product.is_deleted == False, Product.status == ProductStatus.ACTIVE)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    p_attrs = dict(product.attributes or {})

    # Get inventory entry
    inv_query = select(Inventory).where(Inventory.product_id == product.id, Inventory.is_deleted == False)
    inv_res = await db.execute(inv_query)
    inv = inv_res.scalars().first()

    # Get product price entry
    price_query = select(ProductPrice).where(
        ProductPrice.product_id == product.id,
        ProductPrice.is_active == True
    )
    if inv:
        price_query = price_query.where(ProductPrice.vendor_id == inv.vendor_id)
        
    price_res = await db.execute(price_query)
    price_obj = price_res.scalars().first()

    p_attrs["price"] = float(price_obj.price) if price_obj else 30.0

    if inv:
        p_attrs["quantity"] = float(inv.quantity)
        p_attrs["vendor_id"] = str(inv.vendor_id)
        product.stock = float(inv.quantity)
    else:
        p_attrs["quantity"] = 0.0
        p_attrs["vendor_id"] = ""
        product.stock = 0.0

    if "image_emoji" not in p_attrs:
        p_attrs["image_emoji"] = "🥬"
    product.attributes = p_attrs

    return APIResponse(success=True, data=product)
