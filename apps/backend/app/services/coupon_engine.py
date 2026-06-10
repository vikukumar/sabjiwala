"""
Coupon validation and discount calculation engine.
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.coupon import Coupon, CouponType, CouponUsage, CouponScope
from app.models.order import Order, OrderStatus, Cart, CartItem
from app.models.user import User, UserAddress
from app.models.product import Product


class CouponEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def validate_coupon(
        self,
        code: str,
        user_id: UUID,
        vendor_id: UUID,
        payment_method: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate a coupon for a given user and vendor cart.
        """
        # Fetch coupon with rules
        result = await self.db.execute(
            select(Coupon)
            .options(selectinload(Coupon.rules))
            .where(func.lower(Coupon.code) == func.lower(code), Coupon.is_deleted == False)
        )
        coupon = result.scalars().first()

        if not coupon:
            return {"valid": False, "discount": 0.0, "message": "Coupon code not found"}

        if not coupon.is_active:
            return {"valid": False, "discount": 0.0, "message": "Coupon is inactive"}

        now = datetime.now(timezone.utc)
        # Ensure dates are timezone-aware if coupon.starts_at/expires_at are
        starts_at = coupon.starts_at if coupon.starts_at.tzinfo else coupon.starts_at.replace(tzinfo=timezone.utc)
        expires_at = None
        if coupon.expires_at:
            expires_at = coupon.expires_at if coupon.expires_at.tzinfo else coupon.expires_at.replace(tzinfo=timezone.utc)

        if now < starts_at:
            return {"valid": False, "discount": 0.0, "message": "Coupon promotion has not started yet"}

        if expires_at and now > expires_at:
            return {"valid": False, "discount": 0.0, "message": "Coupon code has expired"}

        # Scope verification
        if coupon.scope == CouponScope.VENDOR and coupon.vendor_id != vendor_id:
            return {"valid": False, "discount": 0.0, "message": "Coupon is not valid for this vendor"}

        # Total usage limits
        if coupon.max_total_uses is not None and coupon.current_uses >= coupon.max_total_uses:
            return {"valid": False, "discount": 0.0, "message": "Coupon usage limit reached"}

        # Per-user usage limits
        usage_result = await self.db.execute(
            select(func.count(CouponUsage.id))
            .where(CouponUsage.coupon_id == coupon.id, CouponUsage.user_id == user_id, CouponUsage.is_deleted == False)
        )
        user_uses = usage_result.scalar() or 0
        if user_uses >= coupon.max_uses_per_user:
            return {"valid": False, "discount": 0.0, "message": "You have already used this coupon maximum times"}

        # Fetch cart subtotal and items
        cart_result = await self.db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.user_id == user_id, Cart.vendor_id == vendor_id, Cart.is_deleted == False)
        )
        cart = cart_result.scalars().first()
        if not cart or not cart.items:
            return {"valid": False, "discount": 0.0, "message": "Cart is empty"}

        subtotal = 0.0
        cart_items_list = []
        for item in cart.items:
            if not item.is_deleted:
                subtotal += float(item.unit_price) * item.quantity
                cart_items_list.append(item)

        if subtotal < float(coupon.min_order_amount):
            return {
                "valid": False,
                "discount": 0.0,
                "message": f"Minimum order amount of ₹{coupon.min_order_amount} required to use this coupon"
            }

        # Apply rules
        for rule in coupon.rules:
            if rule.is_deleted:
                continue

            r_type = rule.rule_type
            r_data = rule.rule_data

            if r_type == "first_order_only":
                order_result = await self.db.execute(
                    select(func.count(Order.id))
                    .where(
                        Order.user_id == user_id,
                        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                        Order.is_deleted == False
                    )
                )
                prev_orders = order_result.scalar() or 0
                if prev_orders > 0:
                    return {"valid": False, "discount": 0.0, "message": "This coupon is valid on your first order only"}

            elif r_type == "geo_restriction":
                # Get default address of user
                addr_result = await self.db.execute(
                    select(UserAddress).where(UserAddress.user_id == user_id, UserAddress.is_default == True, UserAddress.is_deleted == False)
                )
                address = addr_result.scalars().first()
                if not address:
                    return {"valid": False, "discount": 0.0, "message": "Please set a default delivery address to apply coupon"}
                
                allowed_cities = r_data.get("cities", [])
                allowed_states = r_data.get("states", [])
                
                if allowed_cities and address.city not in allowed_cities:
                    return {"valid": False, "discount": 0.0, "message": "Coupon not valid in your delivery city"}
                if allowed_states and address.state not in allowed_states:
                    return {"valid": False, "discount": 0.0, "message": "Coupon not valid in your delivery state"}

            elif r_type == "category_restriction":
                mode = r_data.get("mode", "include")
                cat_ids = [UUID(cid) if isinstance(cid, str) else cid for cid in r_data.get("category_ids", [])]
                
                # Fetch categories of products in cart
                valid_items = []
                for item in cart_items_list:
                    prod_result = await self.db.execute(
                        select(Product).where(Product.id == item.product_id)
                    )
                    product = prod_result.scalars().first()
                    if product:
                        is_match = product.category_id in cat_ids
                        if (mode == "include" and is_match) or (mode == "exclude" and not is_match):
                            valid_items.append(item)
                
                if not valid_items:
                    return {"valid": False, "discount": 0.0, "message": "None of the products in your cart qualify for this coupon"}

            elif r_type == "product_restriction":
                mode = r_data.get("mode", "include")
                prod_ids = [UUID(pid) if isinstance(pid, str) else pid for pid in r_data.get("product_ids", [])]
                
                valid_items = []
                for item in cart_items_list:
                    is_match = item.product_id in prod_ids
                    if (mode == "include" and is_match) or (mode == "exclude" and not is_match):
                        valid_items.append(item)
                
                if not valid_items:
                    return {"valid": False, "discount": 0.0, "message": "None of the products in your cart qualify for this coupon"}

            elif r_type == "payment_method":
                if payment_method:
                    allowed_methods = r_data.get("methods", [])
                    if allowed_methods and payment_method not in allowed_methods:
                        return {
                            "valid": False,
                            "discount": 0.0,
                            "message": f"Coupon valid only with payment methods: {', '.join(allowed_methods)}"
                        }

        # Calculate discount
        discount = 0.0
        if coupon.coupon_type == CouponType.PERCENTAGE:
            discount = subtotal * (coupon.discount_value / 100.0)
            if coupon.max_discount_amount is not None:
                discount = min(discount, float(coupon.max_discount_amount))
        elif coupon.coupon_type == CouponType.FIXED:
            discount = float(coupon.discount_value)
        elif coupon.coupon_type == CouponType.FREE_DELIVERY:
            discount = 0.0  # Handled in checkout by setting delivery charge to 0

        discount = min(discount, subtotal)

        return {
            "valid": True,
            "discount": discount,
            "message": "Coupon applied successfully",
            "coupon_id": coupon.id,
            "coupon_type": coupon.coupon_type.value,
        }
