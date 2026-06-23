"""
Orders API endpoints.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, CheckoutRequest, OrderResponse, OrderStatusUpdate,
    PaginatedResponse, PaginationMeta, ReturnRequestCreate, ItemRejectionRequest
)
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.order import Order, OrderStatus, ReturnRequest, ReturnStatus
from app.models.payment import WalletTransactionType
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService

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

    # Fetch System Settings for Admin Overrides
    # Fetch System Settings for Admin Overrides
    from app.models.system import SystemSetting
    
    admin_pf_toggle_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "enable_platform_fee"))
    admin_pf_toggle = admin_pf_toggle_res.scalars().first()

    admin_pf_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "default_platform_fee"))
    admin_pf = admin_pf_res.scalars().first()
    
    admin_cf_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "default_convenience_fee"))
    admin_cf = admin_cf_res.scalars().first()
    
    admin_fd_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "free_delivery_above"))
    admin_fd = admin_fd_res.scalars().first()

    # Precedence: Admin Overrides > Vendor > Default 0.0
    
    # Platform Fee
    platform_fee = 0.0
    
    # Safely check if platform fee is globally enabled
    admin_pf_enabled = False
    if admin_pf_toggle and admin_pf_toggle.value:
        admin_pf_enabled = str(admin_pf_toggle.value).lower() == "true"
        
    is_platform_enabled = rule.is_platform_fee_enabled if rule else admin_pf_enabled
    if is_platform_enabled:
        if rule and rule.platform_fee is not None:
            platform_fee = float(rule.platform_fee)
        elif admin_pf and admin_pf.value:
            platform_fee = float(admin_pf.value)
            
    # Convenience Fee
    convenience_fee = 0.0
    if rule and rule.convenience_fee is not None:
        convenience_fee = float(rule.convenience_fee)
    elif admin_cf and admin_cf.value:
        convenience_fee = float(admin_cf.value)

    # Free Delivery Above
    free_delivery_limit = 0.0
    if admin_fd and admin_fd.value is not None:
        try:
            free_delivery_limit = float(admin_fd.value)
        except ValueError:
            pass
    elif rule and rule.free_delivery_above is not None:
        free_delivery_limit = float(rule.free_delivery_above)

    if rule:
        if subtotal < float(rule.min_order_amount):
            raise HTTPException(status_code=400, detail=f"Minimum order amount for this vendor is ₹{rule.min_order_amount}")
    
    if free_delivery_limit > 0 and subtotal >= free_delivery_limit:
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
        platform_fee = 0.0

    # Coupon discount (must calculate earlier to use in tax, but let's decouple coupon from tax for now, wait: GST should be calculated AFTER discount. Let's compute coupon_discount first)
    coupon_discount = 0.0
    applied_coupon_code = body.coupon_code or cart.coupon_code
    if applied_coupon_code:
        from app.services.coupon_engine import CouponEngine
        coupon_engine = CouponEngine(db)
        validation = await coupon_engine.validate_coupon(
            applied_coupon_code, current_user["user_id"], vendor_id, body.payment_method
        )
        if validation["valid"]:
            coupon_discount = round(float(validation["discount"]), 2)
            if validation.get("coupon_type") == "free_delivery":
                delivery_charge = 0.0

    # Round individual components first to prevent floating point/off-by-one errors
    subtotal = round(subtotal, 2)
    delivery_charge = round(delivery_charge, 2)
    packaging_charge = round(packaging_charge, 2)
    platform_fee = round(platform_fee, 2)
    convenience_fee = round(convenience_fee, 2)

    # Tax calculation (standard 5% applied to everything after discount)
    taxable_amount = max(0.0, subtotal + delivery_charge + packaging_charge + platform_fee + convenience_fee - coupon_discount)
    tax_amount = round(taxable_amount * 0.05, 2)

    # Wallet deduction
    wallet_amount = 0.0
    wallet_balance = 0.0
    if body.use_wallet:
        wallet = await service.payment_service.get_or_create_wallet(current_user["user_id"])
        wallet_balance = float(wallet.balance)
        total_before_wallet = round(subtotal + delivery_charge + tax_amount + packaging_charge + platform_fee + convenience_fee - coupon_discount, 2)
        wallet_amount = round(min(wallet_balance, total_before_wallet), 2)

    total_amount = round(subtotal + delivery_charge + tax_amount + packaging_charge + platform_fee + convenience_fee - coupon_discount - wallet_amount, 2)

    return APIResponse(
        success=True,
        data={
            "subtotal": round(subtotal, 2),
            "delivery_charge": round(delivery_charge, 2),
            "original_delivery_charge": round(original_delivery_charge, 2),
            "platform_fee": round(platform_fee, 2),
            "convenience_fee": round(convenience_fee, 2),
            "tax_amount": round(tax_amount, 2),
            "packaging_charge": round(packaging_charge, 2),
            "original_packaging_charge": round(original_packaging_charge, 2),
            "coupon_discount": round(coupon_discount, 2),
            "wallet_balance": round(wallet_balance, 2),
            "wallet_deduction": round(wallet_amount, 2),
            "total_amount": round(total_amount, 2),
            "distance_km": round(distance_km, 2),
            "free_delivery_above": round(free_delivery_limit, 2),
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
        if status_filter == "pending":
            query = query.where(Order.status.in_([
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.ACCEPTED,
                OrderStatus.PACKED,
                OrderStatus.ASSIGNED,
                OrderStatus.PICKED,
                OrderStatus.OUT_FOR_DELIVERY
            ]))
        else:
            try:
                valid_status = OrderStatus(status_filter)
                query = query.where(Order.status == valid_status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status filter: {status_filter}")

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


async def enrich_order_response(order: Order, db: AsyncSession) -> OrderResponse:
    res_data = OrderResponse.model_validate(order)
    res_data.delivery_otp = order.delivery_otp
    res_data.actual_delivery_time = order.actual_delivery_time
    
    # Fetch vendor store details
    from app.models.vendor import VendorStore, Vendor
    store_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == order.vendor_id))
    store = store_res.scalars().first()
    if store:
        res_data.vendor_store = {
            "name": store.store_name,
            "latitude": store.latitude,
            "longitude": store.longitude,
            "address": store.address_line_1,
        }
    
    metadata = order.metadata_json or {}
    delivery_option = metadata.get("delivery_option")
    
    if order.delivery_boy_id:
        from app.models.user import User
        from app.models.delivery import DeliveryBoy
        
        user_res = await db.execute(select(User).where(User.id == order.delivery_boy_id))
        user = user_res.scalars().first()
        
        boy_res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.user_id == order.delivery_boy_id))
        boy = boy_res.scalars().first()
        
        if user:
            phone_val = user.phone
            if not phone_val or len(str(phone_val).strip()) < 10:
                vendor_res = await db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
                vendor = vendor_res.scalars().first()
                if vendor and vendor.contact_phone:
                    phone_val = vendor.contact_phone
                else:
                    phone_val = "9876543210"
            res_data.delivery_agent = {
                "name": f"{user.first_name} {user.last_name}".strip(),
                "phone": phone_val,
                "vehicle_type": boy.vehicle_type if boy else "scooty",
                "vehicle_number": boy.vehicle_number if boy else "MH-43-AB-1234",
                "latitude": boy.current_latitude if boy else None,
                "longitude": boy.current_longitude if boy else None,
            }
    elif delivery_option == "self":
        from app.models.user import User
        
        vendor_res = await db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
        vendor = vendor_res.scalars().first()
        if vendor:
            user_res = await db.execute(select(User).where(User.id == vendor.user_id))
            user = user_res.scalars().first()
            
            if user and store:
                phone_val = vendor.contact_phone or user.phone
                if not phone_val or len(str(phone_val).strip()) < 10:
                    phone_val = "9876543210"
                res_data.delivery_agent = {
                    "name": f"{store.store_name} (Self Delivered)".strip(),
                    "phone": phone_val,
                    "vehicle_type": None,
                    "vehicle_number": "Store Self Delivery",
                    "latitude": metadata.get("live_latitude") or store.latitude,
                    "longitude": metadata.get("live_longitude") or store.longitude,
                }
                
    # Fetch Return Request if exists
    from app.models.order import ReturnRequest
    return_res = await db.execute(select(ReturnRequest).where(ReturnRequest.order_id == order.id))
    return_req = return_res.scalars().first()
    if return_req:
        res_data.return_request = {
            "id": str(return_req.id),
            "status": return_req.status.value if hasattr(return_req.status, 'value') else str(return_req.status),
            "reason": return_req.reason,
            "refund_amount": float(return_req.refund_amount) if return_req.refund_amount else 0,
            "admin_notes": return_req.admin_notes,
            "created_at": return_req.created_at.isoformat() if return_req.created_at else None
        }

    return res_data


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

    res_data = await enrich_order_response(order, db)
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
            delivery_option=body.delivery_option,
            otp=body.otp,
            images=body.images
        )
        res_data = await enrich_order_response(order, db)
        return APIResponse(success=True, message="Order status updated", data=res_data)
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

    # Check for existing ReturnRequest
    from app.models.order import ReturnRequest
    existing_res = await db.execute(select(ReturnRequest).where(ReturnRequest.order_id == order_id))
    if existing_res.scalars().first():
        raise HTTPException(status_code=400, detail="A return request already exists for this order")

    # Check 4-hour window
    from datetime import datetime, timezone, timedelta
    reference_time = order.actual_delivery_time or order.updated_at
    if reference_time:
        # ensure timezone aware
        if reference_time.tzinfo is None:
            reference_time = reference_time.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        if now_utc > reference_time + timedelta(hours=4):
            raise HTTPException(status_code=400, detail="Return requests are only allowed within 4 hours of delivery")

    # Create return request record
    ret_req = ReturnRequest(
        order_id=order_id,
        user_id=current_user["user_id"],
        vendor_id=order.vendor_id,
        status=ReturnStatus.REQUESTED,
        reason=body.reason,
        images=body.images or [],
        refund_amount=order.total_amount,
        return_items=body.return_items or [],
    )
    db.add(ret_req)
    await db.commit()

    return APIResponse(success=True, message="Return request submitted", data={"return_request_id": str(ret_req.id)})


@router.post("/{order_id}/reject-items", response_model=APIResponse[OrderResponse])
async def reject_order_items(
    order_id: UUID,
    body: ItemRejectionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adjust order quantities for doorstep rejections and issue immediate refund or update COD total."""
    # 1. Fetch Order
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.is_deleted == False)
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Authorization Check
    role = current_user.get("role") or current_user.get("user_type", "customer")
    is_authorized = False

    if role in ["admin", "super_admin"]:
        is_authorized = True
    elif role == "delivery_boy":
        if order.delivery_boy_id == current_user["user_id"]:
            is_authorized = True
    elif role in ["vendor", "vendor_manager"]:
        from app.models.vendor import Vendor
        vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
        if vendor and order.vendor_id == vendor.id:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to perform doorstep rejection for this order."
        )

    # 3. Status Check
    if order.status not in [OrderStatus.PICKED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED]:
        raise HTTPException(
            status_code=400,
            detail="Doorstep item rejection is only allowed when order is picked, out for delivery, or delivered."
        )

    if not body.rejected_items:
        raise HTTPException(status_code=400, detail="No rejected items provided.")

    # 4. Process Rejections
    original_paid = float(order.total_amount) + float(order.wallet_amount)
    
    # Track inventory modifications to commit them
    rejection_records = []
    
    for r_item in body.rejected_items:
        # Find item in order
        order_item = None
        for item in order.items:
            if item.product_id == r_item.product_id and item.variant_id == r_item.variant_id:
                order_item = item
                break
        
        if not order_item:
            raise HTTPException(
                status_code=400,
                detail=f"Product {r_item.product_id} is not part of this order."
            )
            
        if r_item.rejected_quantity <= 0:
            continue
            
        if r_item.rejected_quantity > order_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Rejected quantity {r_item.rejected_quantity} exceeds ordered quantity {order_item.quantity} for {order_item.product_name}."
            )

        # Reduce order item quantity
        qty_change = r_item.rejected_quantity
        order_item.quantity = order_item.quantity - qty_change
        order_item.total_price = round(float(order_item.unit_price) * order_item.quantity, 2)
        order_item.tax_amount = round(order_item.total_price * 0.05, 2)

        # Return stock to vendor inventory
        from app.models.product import Inventory, InventoryLog
        inv_res = await db.execute(
            select(Inventory).where(
                Inventory.product_id == r_item.product_id,
                Inventory.variant_id == r_item.variant_id,
                Inventory.vendor_id == order.vendor_id,
                Inventory.is_deleted == False
            )
        )
        inventory = inv_res.scalars().first()
        if inventory:
            qty_before = float(inventory.quantity)
            inventory.quantity = qty_before + qty_change
            inventory.is_in_stock = True
            
            # Log inventory change
            inv_log = InventoryLog(
                inventory_id=inventory.id,
                vendor_id=order.vendor_id,
                change_type="add",
                quantity_change=qty_change,
                quantity_before=qty_before,
                quantity_after=qty_before + qty_change,
                reference_type="order",
                reference_id=str(order.id),
                notes=f"Doorstep rejection: {r_item.reason}"
            )
            db.add(inv_log)

        # Record metadata detail
        rejection_records.append({
            "product_id": str(r_item.product_id),
            "variant_id": str(r_item.variant_id) if r_item.variant_id else None,
            "product_name": order_item.product_name,
            "rejected_quantity": float(qty_change),
            "reason": r_item.reason,
            "rejected_at": datetime.now(timezone.utc).isoformat()
        })

    # Save to order metadata
    meta = dict(order.metadata_json) if order.metadata_json else {}
    current_rejections = meta.get("doorstep_rejections", [])
    current_rejections.extend(rejection_records)
    meta["doorstep_rejections"] = current_rejections
    order.metadata_json = meta

    # 5. Recalculate Totals
    new_subtotal = round(sum(float(item.total_price) for item in order.items), 2)
    new_tax_amount = round(new_subtotal * 0.05, 2)

    # Recalculate Coupon Discount
    coupon_discount = 0.0
    if order.coupon_id:
        from app.models.coupon import Coupon
        coupon_res = await db.execute(select(Coupon).where(Coupon.id == order.coupon_id))
        coupon = coupon_res.scalars().first()
        if coupon:
            if coupon.coupon_type == "percentage":
                coupon_discount = round(new_subtotal * (float(coupon.discount_value) / 100.0), 2)
                if coupon.max_discount_amount is not None:
                    coupon_discount = min(coupon_discount, float(coupon.max_discount_amount))
            elif coupon.coupon_type == "fixed":
                coupon_discount = min(float(coupon.discount_value), new_subtotal)
            elif coupon.coupon_type == "free_delivery":
                coupon_discount = 0.0
    
    coupon_discount = round(coupon_discount, 2)
    new_subtotal = round(new_subtotal, 2)

    # Calculate new total before wallet
    new_total_before_wallet = round(new_subtotal + float(order.delivery_charge) + new_tax_amount + float(order.packaging_charge) - coupon_discount, 2)
    new_total_before_wallet = max(0.0, new_total_before_wallet)

    # Wallet amount logic
    new_wallet_amount = min(float(order.wallet_amount), new_total_before_wallet)
    new_wallet_amount = round(new_wallet_amount, 2)
    
    # New final total amount (COD/online payable)
    new_total_amount = round(new_total_before_wallet - new_wallet_amount, 2)

    # Calculate refund due
    new_required = new_total_before_wallet
    refund_due = round(original_paid - new_required, 2)

    # If wallet was used, and the wallet deduction exceeds the new requirement, 
    # we refund the excess wallet amount back.
    wallet_refund_due = round(float(order.wallet_amount) - new_wallet_amount, 2)

    # Update order values
    order.subtotal = new_subtotal
    order.tax_amount = new_tax_amount
    order.coupon_discount = coupon_discount
    order.discount_amount = coupon_discount
    order.wallet_amount = new_wallet_amount
    order.total_amount = new_total_amount

    # Write order status history
    from app.models.order import OrderStatusHistory
    history = OrderStatusHistory(
        order_id=order.id,
        from_status=order.status.value,
        to_status=order.status.value,
        changed_by=current_user["user_id"],
        changed_by_type=role,
        notes=f"Adjusted items at doorstep. Subtotal modified."
    )
    db.add(history)

    # 6. Process financial adjustment
    payment_service = PaymentService(db)
    if order.payment_method == "cod":
        if wallet_refund_due > 0:
            await payment_service.credit_wallet(
                user_id=order.user_id,
                amount=wallet_refund_due,
                txn_type=WalletTransactionType.REFUND,
                reference_type="order",
                reference_id=str(order.id),
                description=f"Refund of excess wallet deduction for doorstep adjustments on COD order {order.order_number}"
            )
    else:
        if refund_due > 0:
            await payment_service.credit_wallet(
                user_id=order.user_id,
                amount=refund_due,
                txn_type=WalletTransactionType.REFUND,
                reference_type="order",
                reference_id=str(order.id),
                description=f"Refund for doorstep rejected items on prepaid order {order.order_number}"
            )

    await db.commit()
    
    # Notify customer via websocket/notification service
    try:
        from app.services.notification_service import NotificationService
        notif = NotificationService(db)
        if order.payment_method != "cod" and refund_due > 0:
            await notif.dispatch(
                event_key="order_refunded",
                user_id=order.user_id,
                variables={
                    "order_number": order.order_number,
                    "refund_amount": str(refund_due),
                    "total_amount": str(order.total_amount)
                },
                reference_type="order",
                reference_id=str(order.id)
            )
        else:
            await notif.dispatch(
                event_key="order_confirmed",
                user_id=order.user_id,
                variables={
                    "order_number": order.order_number,
                    "total_amount": str(order.total_amount)
                },
                reference_type="order",
                reference_id=str(order.id)
            )
    except Exception as e:
        pass

    # Return enriched response
    res_data = await enrich_order_response(order, db)
    return APIResponse(success=True, message="Order adjusted successfully", data=res_data)


@router.get("/{order_id}/invoice")
async def get_order_invoice(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Compile and render a print-friendly invoice HTML for an order."""
    from fastapi.responses import HTMLResponse
    from app.models.system import SystemSetting
    from app.models.order import Order
    from app.models.user import User
    from app.models.vendor import Vendor
    from jinja2 import Template
    
    # Fetch order
    res = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Fetch system invoice settings — template is stored as plain text (s.value),
    # branding is stored as JSON object (s.value_json).
    setting_res = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(["invoice_template_html", "invoice_branding_json"]))
    )
    settings_db = setting_res.scalars().all()
    settings_by_key = {s.key: s for s in settings_db}

    template_setting = settings_by_key.get("invoice_template_html")
    branding_setting = settings_by_key.get("invoice_branding_json")

    # invoice_template must be a plain str for Jinja2
    invoice_template: str = (template_setting.value or "") if template_setting else ""
    # branding is a JSON dict
    branding: dict = (branding_setting.value_json or {}) if branding_setting else {}

    if not invoice_template:
        raise HTTPException(status_code=500, detail="Invoice template not configured")
        
    # Fetch customer
    customer_res = await db.execute(select(User).where(User.id == order.user_id))
    customer = customer_res.scalars().first()
    customer_name = f"{customer.first_name} {customer.last_name}" if customer else "Customer"
    customer_phone = customer.phone if customer else ""
    
    # Fetch vendor
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
    vendor = vendor_res.scalars().first()
    vendor_name = vendor.business_name if vendor else "Vendor"
    vendor_address = "Local Mandi"
    vendor_gst = "N/A"
    
    # Construct template variables
    items_list = []
    for item in order.items:
        items_list.append({
            "name": item.product_name,
            "quantity": item.quantity,
            "unit": item.unit if isinstance(item.unit, str) else str(item.unit),
            "unit_price": float(item.unit_price),
            "total_price": float(item.unit_price) * float(item.quantity)
        })

    # delivery_address is stored as a JSONB dict — flatten it to a readable string
    delivery_addr = order.delivery_address
    if isinstance(delivery_addr, dict):
        parts = [
            delivery_addr.get("address_line_1", ""),
            delivery_addr.get("address_line_2", ""),
            delivery_addr.get("city", ""),
            delivery_addr.get("state", ""),
            delivery_addr.get("postal_code", ""),
        ]
        delivery_address_str = ", ".join(p for p in parts if p)
    else:
        delivery_address_str = str(delivery_addr or "")

    # branding may be stored as a plain string (old format) — fall back safely
    if not isinstance(branding, dict):
        branding = {}

    variables = {
        "company_name": branding.get("company_name", "Sbjiwala"),
        "company_address": branding.get("company_address", ""),
        "company_phone": branding.get("company_phone", ""),
        "company_gstin": branding.get("gstin", ""),
        "order_number": order.order_number,
        "created_at": order.created_at.strftime("%Y-%m-%d %H:%M") if order.created_at else "",
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "vendor_name": vendor_name,
        "vendor_address": vendor_address,
        "vendor_gst": vendor_gst,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "delivery_address": delivery_address_str,
        "items": items_list,
        "subtotal": float(order.subtotal),
        "delivery_charge": float(order.delivery_charge),
        "tax_amount": float(order.tax_amount),
        "packaging_charge": float(order.packaging_charge),
        "discount_amount": float(order.discount_amount),
        "total_amount": float(order.total_amount)
    }

    try:
        html_content = Template(str(invoice_template)).render(**variables)
        return HTMLResponse(content=html_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render invoice template: {str(e)}")

