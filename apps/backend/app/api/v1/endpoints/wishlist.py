"""
Wishlist API endpoints.
"""
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.product import Wishlist, Product, Inventory, ProductPrice

router = APIRouter()


class WishlistAdd(BaseModel):
    product_id: UUID


@router.get("", response_model=APIResponse)
async def get_wishlist(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve wishlist items for the logged-in user."""
    stmt = (
        select(Wishlist)
        .where(Wishlist.user_id == current_user["user_id"], Wishlist.is_deleted == False)
        .order_by(Wishlist.created_at.desc())
    )
    res = await db.execute(stmt)
    wishlist_items = res.scalars().all()

    data = []
    for item in wishlist_items:
        product = item.product
        if not product or product.is_deleted:
            continue

        p_attrs = dict(product.attributes or {})

        # Fetch product price/vendor/stock details exactly like catalog browse
        inv_query = select(Inventory).where(Inventory.product_id == product.id, Inventory.is_deleted == False)
        inv_res = await db.execute(inv_query)
        inv = inv_res.scalars().first()

        price_query = select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.is_active == True,
            ProductPrice.is_deleted == False
        )
        if inv:
            price_query = price_query.where(ProductPrice.vendor_id == inv.vendor_id)
        price_res = await db.execute(price_query)
        price_obj = price_res.scalars().first()

        p_attrs["price"] = float(price_obj.price) if price_obj else 30.0

        if inv:
            p_attrs["quantity"] = float(inv.quantity)
            p_attrs["vendor_id"] = str(inv.vendor_id)
            from app.models.vendor import VendorStore
            store_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == inv.vendor_id))
            store = store_res.scalars().first()
            if store and store.latitude is not None and store.longitude is not None:
                p_attrs["vendor_latitude"] = store.latitude
                p_attrs["vendor_longitude"] = store.longitude
            else:
                p_attrs["vendor_latitude"] = 19.0760
                p_attrs["vendor_longitude"] = 72.8777
        else:
            p_attrs["quantity"] = 0.0
            p_attrs["vendor_id"] = ""
            p_attrs["vendor_latitude"] = 19.0760
            p_attrs["vendor_longitude"] = 72.8777

        if "image_emoji" not in p_attrs:
            p_attrs["image_emoji"] = "🥬"

        data.append({
            "id": str(item.id),
            "product_id": str(item.product_id),
            "product_name": product.name,
            "price": p_attrs["price"],
            "product": {
                "id": str(product.id),
                "name": product.name,
                "slug": product.slug,
                "description": product.description,
                "short_description": product.short_description,
                "category_id": str(product.category_id),
                "unit": product.unit.value if hasattr(product.unit, 'value') else str(product.unit),
                "unit_value": product.unit_value,
                "primary_image_url": product.primary_image_url,
                "status": product.status.value if hasattr(product.status, 'value') else str(product.status),
                "is_featured": product.is_featured,
                "tags": product.tags,
                "attributes": p_attrs,
            }
        })

    return APIResponse(success=True, data=data)


@router.post("", response_model=APIResponse, status_code=201)
async def add_to_wishlist(
    body: WishlistAdd,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a product to the user's wishlist."""
    # Verify product exists and is active
    prod_result = await db.execute(select(Product).where(Product.id == body.product_id, Product.is_deleted == False))
    product = prod_result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already in wishlist (including soft-deleted ones)
    stmt = select(Wishlist).where(
        Wishlist.user_id == current_user["user_id"],
        Wishlist.product_id == body.product_id,
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        if existing.is_deleted:
            existing.is_deleted = False
            existing.updated_at = datetime.now(timezone.utc)
            existing.updated_by = current_user["user_id"]
            await db.flush()
        return APIResponse(success=True, message="Product added to wishlist", data={"id": str(existing.id)})

    # Create wishlist entry
    wishlist_item = Wishlist(
        user_id=current_user["user_id"],
        product_id=body.product_id,
        created_by=current_user["user_id"]
    )
    db.add(wishlist_item)
    await db.flush()

    return APIResponse(success=True, message="Product added to wishlist", data={"id": str(wishlist_item.id)})


@router.delete("/{wishlist_id}", response_model=APIResponse)
async def remove_from_wishlist(
    wishlist_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the wishlist."""
    stmt = select(Wishlist).where(
        Wishlist.id == wishlist_id,
        Wishlist.user_id == current_user["user_id"],
        Wishlist.is_deleted == False
    )
    res = await db.execute(stmt)
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    item.soft_delete(current_user["user_id"])
    await db.flush()

    return APIResponse(success=True, message="Product removed from wishlist")
