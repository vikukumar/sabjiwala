"""
Orders API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, CheckoutRequest, OrderResponse, OrderStatusUpdate,
    PaginatedResponse, PaginationMeta, ReturnRequestCreate
)
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.order import Order, OrderStatus, ReturnRequest, ReturnStatus
from app.services.order_service import OrderService

router = APIRouter()


@router.post("/preview", response_model=APIResponse)
async def preview_order(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    vendor_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Preview order totals (delivery charge, tax, packaging, coupon, wallet deduction)."""
    # 1. Fetch Address
    from app.models.user import UserAddress
    address = None
    if body.address_id:
        addr_result = await db.execute(
            select(UserAddress).where(
                UserAddress.id == body.address_id,
                UserAddress.user_id == current_user["user_id"],
                UserAddress.is_deleted == False
            )
        )
        address = addr_result.scalars().first()
        
    if not address:
        addr_result = await db.execute(
            select(UserAddress).where(
                UserAddress.user_id == current_user["user_id"],
                UserAddress.is_deleted == False
            )
        )
        address = addr_result.scalars().first()
        
    if not address:
        address = UserAddress(
            latitude=None,
            longitude=None,
            label="Mock",
            full_name="Guest",
            phone="",
            address_line_1="No address",
            city="",
            state="",
            country="",
            postal_code=""
        )

    # 2. Fetch Cart
    from app.models.order import Cart
    cart_result = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items))
        .where(Cart.user_id == current_user["user_id"], Cart.vendor_id == vendor_id, Cart.is_deleted == False)
    )
    cart = cart_result.scalars().first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Shopping cart is empty")

    # 3. Calculate subtotal (with markup)
    subtotal = 0.0
    for item in cart.items:
        if item.is_deleted:
            continue
        # Get product price (secured 4.5% markup)
        from app.models.product import ProductPrice
        price_res = await db.execute(
            select(ProductPrice).where(
                ProductPrice.product_id == item.product_id,
                ProductPrice.vendor_id == vendor_id,
                ProductPrice.is_active == True
            )
        )
        prod_price = price_res.scalars().first()
        base_price = float(prod_price.price) if prod_price else float(item.unit_price)
        marked_up_price = round(base_price * 1.045, 2)
        subtotal += marked_up_price * item.quantity

    # 4. Calculate delivery and packaging charges
    service = OrderService(db)
    delivery_charge, distance_km = await service.calculate_delivery_charges(vendor_id, address)
    original_delivery_charge = delivery_charge

    from app.models.vendor import VendorDeliveryRule
    rules_result = await db.execute(
        select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor_id)
    )
    rule = rules_result.scalars().first()
    
    base_packaging = 0.0
    if rule and rule.packaging_fee is not None:
        base_packaging = float(rule.packaging_fee)
        
    if base_packaging == 0.0:
        from app.models.system import SystemSetting
        setting_res = await db.execute(
            select(SystemSetting).where(SystemSetting.key == "platform_handling_fee")
        )
        setting = setting_res.scalars().first()
        base_packaging = float(setting.value) if (setting and setting.value) else 5.0
        
    original_packaging_charge = base_packaging
    packaging_charge = base_packaging

    if rule:
        if subtotal < float(rule.min_order_amount):
            raise HTTPException(status_code=400, detail=f"Minimum order amount for this vendor is ₹{rule.min_order_amount}")
        if rule.free_delivery_above is not None and subtotal >= float(rule.free_delivery_above):
            delivery_charge = 0.0
            
    # Apply platform fee exemptions
    exempt_packaging = False
    if rule and rule.free_platform_fee_above is not None:
        if subtotal >= float(rule.free_platform_fee_above):
            exempt_packaging = True
    else:
        from app.models.system import SystemSetting
        admin_setting_res = await db.execute(
            select(SystemSetting).where(SystemSetting.key == "free_platform_fee_above")
        )
        admin_setting = admin_setting_res.scalars().first()
        if admin_setting and admin_setting.value:
            try:
                if subtotal >= float(admin_setting.value):
                    exempt_packaging = True
            except ValueError:
                pass
                
    if exempt_packaging:
        packaging_charge = 0.0

    # Tax calculation (standard 5%)
    tax_amount = subtotal * 0.05

    # Coupon discount
    coupon_discount = 0.0
    applied_coupon_code = body.coupon_code or cart.coupon_code
    if applied_coupon_code:
        from app.services.coupon_engine import CouponEngine
        coupon_engine = CouponEngine(db)
        validation = await coupon_engine.validate_coupon(
            applied_coupon_code, current_user["user_id"], vendor_id, body.payment_method
        )
        if validation["valid"]:
            coupon_discount = float(validation["discount"])
            if validation.get("coupon_type") == "free_delivery":
                delivery_charge = 0.0

    # Wallet deduction
    wallet_amount = 0.0
    wallet_balance = 0.0
    if body.use_wallet:
        wallet = await service.payment_service.get_or_create_wallet(current_user["user_id"])
        wallet_balance = float(wallet.balance)
        total_before_wallet = subtotal + delivery_charge + tax_amount + packaging_charge - coupon_discount
        wallet_amount = min(wallet_balance, total_before_wallet)

    total_amount = subtotal + delivery_charge + tax_amount + packaging_charge - coupon_discount - wallet_amount

    return APIResponse(
        success=True,
        data={
            "subtotal": round(subtotal, 2),
            "delivery_charge": round(delivery_charge, 2),
            "original_delivery_charge": round(original_delivery_charge, 2),
            "tax_amount": round(tax_amount, 2),
            "packaging_charge": round(packaging_charge, 2),
            "original_packaging_charge": round(original_packaging_charge, 2),
            "coupon_discount": round(coupon_discount, 2),
            "wallet_balance": round(wallet_balance, 2),
            "wallet_deduction": round(wallet_amount, 2),
            "total_amount": round(total_amount, 2),
            "distance_km": round(distance_km, 2),
            "free_delivery_above": round(float(rule.free_delivery_above), 2) if (rule and rule.free_delivery_above is not None) else None,
        }
    )


@router.post("", response_model=APIResponse, status_code=201)
async def place_order(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    vendor_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    address_id = body.address_id
    if not address_id:
        raise HTTPException(status_code=400, detail="Delivery address is required to place an order.")
        
    service = OrderService(db)
    try:
        order, pay_info = await service.place_order(
            user_id=current_user["user_id"],
            vendor_id=vendor_id,
            address_id=address_id,
            payment_method=body.payment_method,
            coupon_code=body.coupon_code,
            use_wallet=body.use_wallet,
            customer_notes=body.customer_notes
        )
        return APIResponse(
            success=True,
            message="Order placed successfully",
            data={
                "order": {
                    "id": str(order.id),
                    "order_number": order.order_number,
                    "total_amount": float(order.total_amount),
                    "status": order.status.value,
                },
                "payment": pay_info
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List orders with role-based visibility and pagination."""
    query = select(Order).where(Order.is_deleted == False).order_by(desc(Order.created_at))

    # RBAC logic
    role = current_user.get("role") or current_user.get("user_type", "customer")
    if role in ["admin", "super_admin"]:
        pass  # Admins see all orders — no filter applied
    elif role == "customer":
        query = query.where(Order.user_id == current_user["user_id"])
    elif role in ["vendor", "vendor_manager"]:
        from app.models.vendor import Vendor
        vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
        if not vendor:
            raise HTTPException(status_code=403, detail="Vendor profile required")
        query = query.where(Order.vendor_id == vendor.id)
    elif role == "delivery_boy":
        query = query.where(Order.delivery_boy_id == current_user["user_id"])

    if status_filter:
        if role in ["vendor", "vendor_manager"] and status_filter == "pending":
            query = query.where(Order.status.in_([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.ACCEPTED, OrderStatus.ASSIGNED]))
        else:
            query = query.where(Order.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_items = await db.scalar(count_query) or 0

    # Limit / Offset
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query.options(selectinload(Order.items)))
    orders = result.scalars().all()

    total_pages = (total_items + page_size - 1) // page_size

    # For admin, batch-fetch vendor stores to populate vendor_store field
    vendor_store_map = {}
    if role in ["admin", "super_admin"] and orders:
        from app.models.vendor import VendorStore
        vendor_ids = list({o.vendor_id for o in orders if o.vendor_id})
        if vendor_ids:
            store_res = await db.execute(
                select(VendorStore).where(VendorStore.vendor_id.in_(vendor_ids))
            )
            for store in store_res.scalars().all():
                vendor_store_map[store.vendor_id] = {
                    "name": store.store_name,
                    "address": store.address_line_1,
                    "city": store.city,
                    "latitude": store.latitude,
                    "longitude": store.longitude,
                }

    def build_response(o: Order) -> OrderResponse:
        r = OrderResponse.model_validate(o)
        if o.vendor_id in vendor_store_map:
            r.vendor_store = vendor_store_map[o.vendor_id]
        return r

    return PaginatedResponse(
        success=True,
        data=[build_response(o) for o in orders],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1
        )
    )


@router.get("/{order_id}", response_model=APIResponse[OrderResponse])
async def get_order_details(
    order_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details for a single order."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.is_deleted == False)
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Construct the response model with delivery boy details
    res_data = OrderResponse.model_validate(order)
    
    # Fetch vendor store details
    from app.models.vendor import VendorStore
    store_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == order.vendor_id))
    store = store_res.scalars().first()
    if store:
        res_data.vendor_store = {
            "name": store.store_name,
            "latitude": store.latitude,
            "longitude": store.longitude,
            "address": store.address_line_1,
        }
    
    if order.delivery_boy_id:
        from app.models.user import User
        from app.models.delivery import DeliveryBoy
        
        user_res = await db.execute(select(User).where(User.id == order.delivery_boy_id))
        user = user_res.scalars().first()
        
        boy_res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.user_id == order.delivery_boy_id))
        boy = boy_res.scalars().first()
        
        if user:
            res_data.delivery_agent = {
                "name": f"{user.first_name} {user.last_name}".strip(),
                "phone": user.phone,
                "vehicle_type": boy.vehicle_type if boy else "scooty",
                "vehicle_number": boy.vehicle_number if boy else "MH-43-AB-1234",
                "latitude": boy.current_latitude if boy else None,
                "longitude": boy.current_longitude if boy else None,
            }
            res_data.delivery_otp = order.delivery_otp

    return APIResponse(success=True, data=res_data)


@router.patch("/{order_id}/status", response_model=APIResponse[OrderResponse])
async def update_order_status(
    order_id: UUID,
    body: OrderStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update order status."""
    service = OrderService(db)
    try:
        order = await service.update_order_status(
            order_id=order_id,
            status=OrderStatus(body.status),
            changed_by=current_user["user_id"],
            user_type=current_user.get("user_type", "customer"),
            notes=body.notes,
            delivery_option=body.delivery_option
        )
        return APIResponse(success=True, message="Order status updated", data=OrderResponse.model_validate(order))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/cancel", response_model=APIResponse)
async def cancel_order(
    order_id: UUID,
    reason: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an active order."""
    service = OrderService(db)
    try:
        await service.update_order_status(
            order_id=order_id,
            status=OrderStatus.CANCELLED,
            changed_by=current_user["user_id"],
            user_type=current_user.get("user_type", "customer"),
            notes=reason or "Cancelled by user request"
        )
        return APIResponse(success=True, message="Order cancelled successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/return", response_model=APIResponse)
async def request_order_return(
    order_id: UUID,
    body: ReturnRequestCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a return request for delivered order."""
    # Find order
    order_res = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == current_user["user_id"])
    )
    order = order_res.scalars().first()
    if not order or order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")

    # Create return request record
    ret_req = ReturnRequest(
        order_id=order_id,
        user_id=current_user["user_id"],
        vendor_id=order.vendor_id,
        status=ReturnStatus.REQUESTED,
        reason=body.reason,
        images=body.images or [],
        refund_amount=order.total_amount,
    )
    db.add(ret_req)
    await db.flush()

    return APIResponse(success=True, message="Return request submitted", data={"return_request_id": str(ret_req.id)})
