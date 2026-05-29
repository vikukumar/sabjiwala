"""
Cart management endpoints — add/remove items, apply coupons, get totals.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import APIResponse, CartItemAdd, CartItemUpdate
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.order import Cart, CartItem
from app.models.product import Inventory, Product, ProductPrice, ProductVariant
from app.models.vendor import Vendor

router = APIRouter()


async def _get_or_create_cart(user_id: UUID, vendor_id: UUID, db: AsyncSession) -> Cart:
    """Get existing cart for vendor or create new one."""
    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items))
        .where(Cart.user_id == user_id, Cart.vendor_id == vendor_id, Cart.is_deleted == False)
    )
    cart = result.scalars().first()
    if not cart:
        cart = Cart(user_id=user_id, vendor_id=vendor_id)
        db.add(cart)
        await db.flush()
    return cart


@router.get("/", response_model=APIResponse)
async def get_cart(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all active carts (one per vendor) for the current user."""
    result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items))
        .where(Cart.user_id == current_user["user_id"], Cart.is_deleted == False)
    )
    carts = result.scalars().all()

    cart_data = []
    for cart in carts:
        items = []
        subtotal = 0.0
        for item in cart.items:
            if item.is_deleted:
                continue
            item_total = float(item.unit_price) * item.quantity
            subtotal += item_total
            items.append({
                "id": str(item.id),
                "product_id": str(item.product_id),
                "variant_id": str(item.variant_id) if item.variant_id else None,
                "vendor_id": str(item.vendor_id),
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "total": item_total,
            })

        cart_data.append({
            "id": str(cart.id),
            "vendor_id": str(cart.vendor_id) if cart.vendor_id else None,
            "coupon_code": cart.coupon_code,
            "items": items,
            "subtotal": subtotal,
            "item_count": len(items),
        })

    return APIResponse(success=True, data=cart_data)


@router.post("/items", response_model=APIResponse, status_code=201)
async def add_to_cart(
    body: CartItemAdd,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an item to the cart."""
    # Validate product exists and is active
    prod_result = await db.execute(select(Product).where(Product.id == body.product_id, Product.is_deleted == False))
    product = prod_result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get price
    price_query = select(ProductPrice).where(
        ProductPrice.product_id == body.product_id,
        ProductPrice.vendor_id == body.vendor_id,
        ProductPrice.is_active == True,
        ProductPrice.is_deleted == False,
    )
    if body.variant_id:
        price_query = price_query.where(ProductPrice.variant_id == body.variant_id)

    price_result = await db.execute(price_query)
    price = price_result.scalars().first()
    if not price:
        raise HTTPException(status_code=400, detail="Price not available for this vendor")

    # Check stock
    inv_query = select(Inventory).where(
        Inventory.product_id == body.product_id,
        Inventory.vendor_id == body.vendor_id,
        Inventory.is_deleted == False,
    )
    inv_result = await db.execute(inv_query)
    inventory = inv_result.scalars().first()
    if inventory and not inventory.is_unlimited and inventory.quantity < body.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    # Get or create cart
    cart = await _get_or_create_cart(current_user["user_id"], body.vendor_id, db)

    # Check if item already in cart
    existing = await db.execute(
        select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == body.product_id,
            CartItem.variant_id == body.variant_id,
            CartItem.vendor_id == body.vendor_id,
            CartItem.is_deleted == False,
        )
    )
    cart_item = existing.scalars().first()

    if cart_item:
        cart_item.quantity += body.quantity
        cart_item.unit_price = float(price.price)
    else:
        cart_item = CartItem(
            cart_id=cart.id,
            product_id=body.product_id,
            variant_id=body.variant_id,
            vendor_id=body.vendor_id,
            quantity=body.quantity,
            unit_price=float(price.price),
        )
        db.add(cart_item)

    await db.flush()
    return APIResponse(success=True, message="Item added to cart")


@router.patch("/items/{item_id}", response_model=APIResponse)
async def update_cart_item(
    item_id: UUID,
    body: CartItemUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update cart item quantity."""
    result = await db.execute(
        select(CartItem)
        .join(Cart)
        .where(CartItem.id == item_id, Cart.user_id == current_user["user_id"], CartItem.is_deleted == False)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if body.quantity <= 0:
        item.soft_delete(current_user["user_id"])
    else:
        item.quantity = body.quantity

    await db.flush()
    return APIResponse(success=True, message="Cart updated")


@router.delete("/items/{item_id}")
async def remove_from_cart(
    item_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the cart."""
    result = await db.execute(
        select(CartItem)
        .join(Cart)
        .where(CartItem.id == item_id, Cart.user_id == current_user["user_id"], CartItem.is_deleted == False)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    item.soft_delete(current_user["user_id"])
    await db.flush()
    return APIResponse(success=True, message="Item removed from cart")


@router.delete("/")
async def clear_cart(
    vendor_id: Optional[UUID] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the entire cart or a specific vendor's cart."""
    query = select(Cart).where(Cart.user_id == current_user["user_id"], Cart.is_deleted == False)
    if vendor_id:
        query = query.where(Cart.vendor_id == vendor_id)

    result = await db.execute(query.options(selectinload(Cart.items)))
    carts = result.scalars().all()

    for cart in carts:
        for item in cart.items:
            item.soft_delete(current_user["user_id"])
        cart.soft_delete(current_user["user_id"])

    await db.flush()
    return APIResponse(success=True, message="Cart cleared")


@router.post("/apply-coupon", response_model=APIResponse)
async def apply_coupon_to_cart(
    code: str,
    vendor_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a coupon code to the cart."""
    result = await db.execute(
        select(Cart).where(Cart.user_id == current_user["user_id"], Cart.vendor_id == vendor_id, Cart.is_deleted == False)
    )
    cart = result.scalars().first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    # Validate coupon
    from app.services.coupon_engine import CouponEngine
    coupon_engine = CouponEngine(db)
    validation = await coupon_engine.validate_coupon(code, current_user["user_id"], vendor_id)

    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["message"])

    cart.coupon_code = code
    await db.flush()

    return APIResponse(success=True, message="Coupon applied", meta=validation)
