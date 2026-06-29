"""
Product Review operations and endpoints.
"""
from typing import List
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, ProductReviewCreate, ProductReviewResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.product import Product, ProductReview
from app.models.order import Order

router = APIRouter()


@router.post("", response_model=APIResponse[ProductReviewResponse], status_code=201)
async def create_review(
    body: ProductReviewCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product review."""
    # Verify product exists
    product_res = await db.execute(select(Product).where(Product.id == body.product_id, Product.is_deleted == False))
    product = product_res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get vendor id from product/inventory or from order if provided
    vendor_id = None
    is_verified = False
    if body.order_id:
        order_res = await db.execute(select(Order).where(Order.id == body.order_id, Order.user_id == current_user["user_id"]))
        order = order_res.scalars().first()
        if order:
            vendor_id = order.vendor_id
            if order.status.value == "delivered":
                is_verified = True

    if not vendor_id:
        # Fallback to catalog inventory vendor
        from app.models.product import Inventory
        inv_res = await db.execute(select(Inventory).where(Inventory.product_id == body.product_id, Inventory.is_deleted == False))
        inv = inv_res.scalars().first()
        if inv:
            vendor_id = inv.vendor_id
        else:
            raise HTTPException(status_code=400, detail="Cannot determine vendor for this product")

    # Check if review already exists
    existing_res = await db.execute(
        select(ProductReview).where(
            ProductReview.product_id == body.product_id,
            ProductReview.user_id == current_user["user_id"],
            ProductReview.order_id == body.order_id
        )
    )
    if existing_res.scalars().first():
        raise HTTPException(status_code=400, detail="You have already reviewed this product for this order")

    review = ProductReview(
        product_id=body.product_id,
        user_id=current_user["user_id"],
        order_id=body.order_id,
        vendor_id=vendor_id,
        rating=body.rating,
        comment=body.comment,
        is_verified_purchase=is_verified,
        is_approved=True,
    )
    db.add(review)
    await db.flush()
    await db.commit()

    # Refresh and return
    response_data = {
        "id": review.id,
        "product_id": review.product_id,
        "product_name": product.name,
        "user_id": review.user_id,
        "order_id": review.order_id,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at or datetime.now(timezone.utc),
    }

    return APIResponse(
        success=True,
        message="Review submitted successfully",
        data=ProductReviewResponse.model_validate(response_data)
    )


@router.get("/me", response_model=APIResponse[List[ProductReviewResponse]])
async def get_my_reviews(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all reviews submitted by the current customer."""
    stmt = (
        select(ProductReview)
        .where(ProductReview.user_id == current_user["user_id"], ProductReview.is_approved == True)
        .order_by(ProductReview.created_at.desc())
    )
    res = await db.execute(stmt)
    reviews = res.scalars().all()

    data = []
    for r in reviews:
        # Get product details
        product_res = await db.execute(select(Product).where(Product.id == r.product_id))
        prod = product_res.scalars().first()
        prod_name = prod.name if prod else "Product"
        prod_image = prod.primary_image_url if prod else None
        prod_emoji = prod.attributes.get("image_emoji") if prod and prod.attributes else "🥬"

        data.append(
            ProductReviewResponse(
                id=r.id,
                product_id=r.product_id,
                product_name=prod_name,
                product_image_url=prod_image,
                product_image_emoji=prod_emoji,
                user_id=r.user_id,
                order_id=r.order_id,
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at or datetime.now(timezone.utc)
            )
        )

    return APIResponse(success=True, data=data)
