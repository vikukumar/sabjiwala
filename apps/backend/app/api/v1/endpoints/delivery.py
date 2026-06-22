"""
Delivery Boy operations and assignment tracking API endpoints.
"""
from fastapi import File
from fastapi import UploadFile
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, AvailabilityToggle, DeliveryLocationUpdate, DeliveryOTPVerify
)
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.delivery import (
    DeliveryBoy, DeliveryAttendance, DeliveryLocation, AvailabilityStatus, DeliveryBoyStatus
)
from app.models.order import Order, OrderStatus
from app.models.vendor import Vendor, VendorStore, VendorStatus

logger = structlog.get_logger()
router = APIRouter()


async def _get_delivery_boy(user_id: UUID, db: AsyncSession) -> DeliveryBoy:
    """Helper to fetch delivery boy profile from user_id."""
    res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.user_id == user_id, DeliveryBoy.is_deleted == False))
    boy = res.scalars().first()
    if not boy:
        raise HTTPException(status_code=403, detail="Delivery agent profile not found")
    return boy


@router.post("/attendance/clock-in", response_model=APIResponse)
async def clock_in(
    latitude: float = Query(...),
    longitude: float = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register delivery agent clock in."""
    boy = await _get_delivery_boy(current_user["user_id"], db)

    if boy.status != DeliveryBoyStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="Your KYC verification is incomplete. Please wait for admin approval."
        )

    # Check if already clocked in
    exist_res = await db.execute(
        select(DeliveryAttendance)
        .where(DeliveryAttendance.delivery_boy_id == boy.id, DeliveryAttendance.clock_out == None)
    )
    if exist_res.scalars().first():
        raise HTTPException(status_code=400, detail="Already clocked in")

    attendance = DeliveryAttendance(
        delivery_boy_id=boy.id,
        clock_in=datetime.now(timezone.utc),
        clock_in_latitude=latitude,
        clock_in_longitude=longitude,
    )
    db.add(attendance)
    
    boy.current_latitude = latitude
    boy.current_longitude = longitude
    boy.last_location_update = datetime.now(timezone.utc)
    boy.availability = AvailabilityStatus.AVAILABLE
    await db.flush()
    await db.commit()

    return APIResponse(success=True, message="Clock-in successful. You are now online.")


@router.post("/attendance/clock-out", response_model=APIResponse)
async def clock_out(
    latitude: float = Query(...),
    longitude: float = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register delivery agent clock out."""
    boy = await _get_delivery_boy(current_user["user_id"], db)

    attendance_res = await db.execute(
        select(DeliveryAttendance)
        .where(DeliveryAttendance.delivery_boy_id == boy.id, DeliveryAttendance.clock_out == None)
    )
    attendance = attendance_res.scalars().first()
    if not attendance:
        raise HTTPException(status_code=400, detail="Not clocked in")

    now = datetime.now(timezone.utc)
    attendance.clock_out = now
    attendance.clock_out_latitude = latitude
    attendance.clock_out_longitude = longitude
    
    # Calculate hours
    delta = now - attendance.clock_in
    attendance.total_hours = delta.total_seconds() / 3600.0
    
    boy.availability = AvailabilityStatus.OFFLINE
    await db.flush()
    await db.commit()

    return APIResponse(success=True, message="Clock-out successful. You are now offline.")


@router.patch("/availability", response_model=APIResponse)
async def toggle_availability(
    body: AvailabilityToggle,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle delivery agent availability status (online/offline)."""
    boy = await _get_delivery_boy(current_user["user_id"], db)

    if boy.status != DeliveryBoyStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="Your KYC verification is incomplete. Please wait for admin approval."
        )
    
    boy.availability = AvailabilityStatus.AVAILABLE if body.is_available else AvailabilityStatus.OFFLINE
    await db.flush()
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Availability updated to {boy.availability.value}"
    )


@router.post("/location", response_model=APIResponse)
async def update_location(
    body: DeliveryLocationUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update delivery agent's current location via REST API."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    
    boy.current_latitude = body.latitude
    boy.current_longitude = body.longitude
    boy.last_location_update = datetime.now(timezone.utc)
    
    # Log location in history
    location_log = DeliveryLocation(
        delivery_boy_id=boy.id,
        latitude=body.latitude,
        longitude=body.longitude,
        accuracy=body.accuracy,
        speed=body.speed,
        heading=body.heading,
    )
    db.add(location_log)
    await db.flush()
    await db.commit()
    return APIResponse(success=True, message="Location updated successfully")


@router.get("/assignments", response_model=APIResponse)
async def get_assignments(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active delivery tasks assigned to the current delivery boy."""
    # Find orders assigned to this user that are not yet delivered/cancelled
    res = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.delivery_boy_id == current_user["user_id"],
            Order.status.in_([
                OrderStatus.ASSIGNED,
                OrderStatus.ACCEPTED,
                OrderStatus.PACKED,
                OrderStatus.PICKED,
                OrderStatus.OUT_FOR_DELIVERY
            ]),
            Order.is_deleted == False
        )
    )
    orders = res.scalars().all()
    
    # Pre-fetch vendor stores to avoid N+1 queries
    vendor_ids = [order.vendor_id for order in orders]
    vendor_stores = {}
    if vendor_ids:
        store_res = await db.execute(
            select(VendorStore).where(VendorStore.vendor_id.in_(vendor_ids))
        )
        for store in store_res.scalars().all():
            vendor_stores[store.vendor_id] = store

    data = []
    for order in orders:
        store = vendor_stores.get(order.vendor_id)
        store_data = {
            "store_name": store.store_name,
            "address_line_1": store.address_line_1,
            "address_line_2": store.address_line_2,
            "city": store.city,
            "state": store.state,
            "postal_code": store.postal_code,
            "latitude": store.latitude,
            "longitude": store.longitude,
        } if store else None

        items_data = []
        for item in order.items:
            if not item.is_deleted:
                items_data.append({
                    "id": str(item.id),
                    "product_id": str(item.product_id),
                    "variant_id": str(item.variant_id) if item.variant_id else None,
                    "product_name": item.product_name,
                    "variant_name": item.variant_name,
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "total_price": float(item.total_price),
                    "unit": item.unit
                })

        data.append({
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status.value,
            "delivery_address": order.delivery_address,
            "delivery_latitude": order.delivery_latitude,
            "delivery_longitude": order.delivery_longitude,
            "total_amount": float(order.total_amount),
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "customer_notes": order.customer_notes,
            "estimated_delivery_time": order.estimated_delivery_time.isoformat() if order.estimated_delivery_time else None,
            "vendor_store": store_data,
            "items": items_data,
        })

    return APIResponse(success=True, data=data)


@router.post("/orders/{order_id}/pickup", response_model=APIResponse)
async def pickup_order(
    order_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark order picked up from vendor."""
    from app.services.order_service import OrderService
    service = OrderService(db)

    # Verify assignment
    res = await db.execute(
        select(Order).where(Order.id == order_id, Order.delivery_boy_id == current_user["user_id"])
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=403, detail="Order not assigned to you")

    try:
        await service.update_order_status(
            order_id=order_id,
            status=OrderStatus.PICKED,
            changed_by=current_user["user_id"],
            user_type="delivery_boy",
            notes="Order picked up by delivery boy"
        )
        # Advance to out_for_delivery automatically
        await service.update_order_status(
            order_id=order_id,
            status=OrderStatus.OUT_FOR_DELIVERY,
            changed_by=current_user["user_id"],
            user_type="delivery_boy",
            notes="Order out for delivery"
        )
        await db.commit()
        return APIResponse(success=True, message="Order picked up and marked out for delivery")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/deliver", response_model=APIResponse)
async def deliver_order(
    order_id: UUID,
    body: DeliveryOTPVerify,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify delivery OTP and mark order delivered."""
    from app.services.order_service import OrderService
    service = OrderService(db)

    res = await db.execute(
        select(Order).where(Order.id == order_id, Order.delivery_boy_id == current_user["user_id"])
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=403, detail="Order not assigned to you")

    if order.delivery_otp != body.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code. Delivery validation failed.")

    if not body.images or len(body.images) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 verification photos are required to complete delivery.")

    try:
        # Save verification images
        meta = dict(order.metadata_json) if order.metadata_json else {}
        meta["delivery_proof_images"] = body.images
        order.metadata_json = meta

        await service.update_order_status(
            order_id=order_id,
            status=OrderStatus.DELIVERED,
            changed_by=current_user["user_id"],
            user_type="delivery_boy",
            notes="Delivered with OTP verification",
            otp=body.otp,
            images=body.images
        )
        
        # Free delivery boy concurrent orders count
        boy = await _get_delivery_boy(current_user["user_id"], db)
        boy.current_order_count = max(0, boy.current_order_count - 1)
        boy.total_deliveries += 1
        if boy.current_order_count == 0:
            boy.availability = AvailabilityStatus.AVAILABLE

        await db.commit()
        return APIResponse(success=True, message="Order delivered successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=APIResponse)
async def get_my_delivery_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current delivery agent's profile including vendor_id to identify private couriers."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    
    # Fetch wallet details
    from app.models.delivery import DeliveryWallet
    vw_res = await db.execute(select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == boy.id))
    wallet = vw_res.scalars().first()
    
    data = {
        "id": str(boy.id),
        "user_id": str(boy.user_id),
        "vendor_id": str(boy.vendor_id) if boy.vendor_id else None,
        "status": boy.status.value,
        "availability": boy.availability.value,
        "vehicle_type": boy.vehicle_type,
        "vehicle_number": boy.vehicle_number,
        "wallet_balance": float(wallet.balance) if wallet else 0.0,
        "cash_in_hand": float(wallet.cash_in_hand) if wallet else 0.0,
    }
    return APIResponse(success=True, data=data)


@router.get("/vendors", response_model=APIResponse)
async def get_active_vendors(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all approved active vendor stores for locator map."""
    # Authenticate rider
    await _get_delivery_boy(current_user["user_id"], db)
    
    stmt = (
        select(VendorStore)
        .join(Vendor, Vendor.id == VendorStore.vendor_id)
        .where(Vendor.status == VendorStatus.APPROVED, Vendor.is_deleted == False)
    )
    res = await db.execute(stmt)
    stores = res.scalars().all()
    
    data = [
        {
            "id": str(store.id),
            "vendor_id": str(store.vendor_id),
            "store_name": store.store_name,
            "address_line_1": store.address_line_1,
            "address_line_2": store.address_line_2,
            "city": store.city,
            "latitude": store.latitude,
            "longitude": store.longitude,
            "is_open": store.is_open,
        }
        for store in stores
        if store.latitude is not None and store.longitude is not None
    ]
    return APIResponse(success=True, data=data)


# ===== Delivery KYC Endpoints =====

@router.get("/profile", response_model=APIResponse)
async def get_delivery_profile_alias(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alias for /me endpoint used by KYC page."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    from app.models.delivery import DeliveryWallet
    vw_res = await db.execute(select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == boy.id))
    wallet = vw_res.scalars().first()

    # Query User table to retrieve profile details
    from app.models.user import User
    user_res = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = user_res.scalars().first()

    # Map status to approved/pending/rejected based on boy's account status
    status_map = {
        DeliveryBoyStatus.ACTIVE: "approved",
        DeliveryBoyStatus.INACTIVE: "pending",
        DeliveryBoyStatus.SUSPENDED: "rejected",
        DeliveryBoyStatus.ON_LEAVE: "pending",
    }
    kyc_status = status_map.get(boy.status, "pending")

    # Fetch uploaded KYC documents
    from app.models.storage import FileMetadata
    docs_res = await db.execute(
        select(FileMetadata).where(
            FileMetadata.entity_id == str(boy.id),
            FileMetadata.entity_type == "delivery_kyc",
            FileMetadata.is_deleted == False
        )
    )
    docs = docs_res.scalars().all()
    kyc_docs = []
    for doc in docs:
        doc_type = doc.custom_metadata.get("document_type") if doc.custom_metadata else None
        if doc_type:
            kyc_docs.append({
                "document_type": doc_type,
                "file_url": f"/api/v1/storage/{doc.id}",
                "original_filename": doc.original_filename
            })

    data = {
        "id": str(boy.id), "user_id": str(boy.user_id),
        "full_name": f"{user.first_name} {user.last_name}" if user else "",
        "phone": user.phone if user else "",
        "kyc_status": kyc_status,
        "kyc_documents": kyc_docs,
        "vehicle_type": boy.vehicle_type, "vehicle_number": boy.vehicle_number,
        "is_online": boy.availability.value == "available",
        "average_rating": float(getattr(boy, "average_rating", 0) or 0),
        "total_deliveries": getattr(boy, "total_deliveries", 0),
        "wallet_balance": float(wallet.balance if wallet else 0),
        "cash_in_hand": float(wallet.cash_in_hand if wallet else 0),
    }
    return APIResponse(success=True, data=data)


@router.post("/kyc/upload", response_model=APIResponse)
async def upload_kyc_document(
    document_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a KYC document for the delivery boy."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    try:
        from app.services.storage_service import StorageService
        storage = StorageService(db)
        contents = await file.read()
        metadata = await storage.save_file(
            file_bytes=contents,
            original_filename=file.filename or "unknown",
            owner_id=current_user["user_id"],
            vendor_id=boy.vendor_id,
            bucket="public",
            is_public=True,
            entity_type="delivery_kyc",
            entity_id=str(boy.id)
        )
        metadata.custom_metadata = {"document_type": document_type}
        await db.flush()
        url = f"/api/v1/storage/{metadata.id}"
        return APIResponse(success=True, data={"url": url, "document_type": document_type})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/kyc/submit", response_model=APIResponse)
async def submit_kyc(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit KYC documents for review."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    boy.status = DeliveryBoyStatus.INACTIVE
    await db.flush()
    await db.commit()
    return APIResponse(success=True, message="KYC documents submitted for review. Approval takes 24-48 hours.")


@router.get("/nearby-orders", response_model=APIResponse)
async def get_nearby_orders(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve unassigned orders near the delivery boy's current location."""
    boy = await _get_delivery_boy(current_user["user_id"], db)
    
    # Determine which vendors this boy can deliver for
    if boy.vendor_id:
        # Private courier: only their vendor's orders
        vendor_filter = [Order.vendor_id == boy.vendor_id]
    else:
        # Public courier: only vendors that do not have private delivery boys
        private_vendors_res = await db.execute(
            select(DeliveryBoy.vendor_id)
            .where(DeliveryBoy.vendor_id != None, DeliveryBoy.is_deleted == False)
        )
        private_vendor_ids = {row[0] for row in private_vendors_res.all()}
        
        if private_vendor_ids:
            vendor_filter = [Order.vendor_id.not_in(list(private_vendor_ids))]
        else:
            vendor_filter = []

    # Fetch unassigned orders (must be accepted/packed and not assigned yet)
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.delivery_boy_id == None,
            Order.status.in_([OrderStatus.ACCEPTED, OrderStatus.PACKED]),
            Order.is_deleted == False,
            *vendor_filter
        )
    )
    res = await db.execute(stmt)
    all_orders = res.scalars().all()
    
    # Filter only auto-delivery (platform rider) orders in Python to avoid raw json SQL typecast bugs
    orders = []
    for order in all_orders:
        meta = order.metadata_json or {}
        if meta.get("delivery_option") == "auto":
            orders.append(order)
    
    # Pre-fetch vendor stores
    vendor_ids = [order.vendor_id for order in orders]
    vendor_stores = {}
    if vendor_ids:
        store_res = await db.execute(
            select(VendorStore).where(VendorStore.vendor_id.in_(vendor_ids))
        )
        for store in store_res.scalars().all():
            vendor_stores[store.vendor_id] = store

    data = []
    for order in orders:
        store = vendor_stores.get(order.vendor_id)
        if not store or store.latitude is None or store.longitude is None:
            continue
            
        # Distance from boy's current location to store
        distance = 0.0
        if boy.current_latitude is not None and boy.current_longitude is not None:
            from app.services.map_service import MapService
            map_service = MapService()
            distance = map_service.calculate_haversine_distance(
                store.latitude, store.longitude,
                boy.current_latitude, boy.current_longitude
            )
        
        # Filter nearby orders (e.g. within 15 km)
        if boy.current_latitude is not None and distance > 15.0:
            continue

        store_data = {
            "store_name": store.store_name,
            "address_line_1": store.address_line_1,
            "address_line_2": store.address_line_2,
            "city": store.city,
            "latitude": store.latitude,
            "longitude": store.longitude,
        }

        data.append({
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status.value,
            "delivery_address": order.delivery_address,
            "delivery_latitude": order.delivery_latitude,
            "delivery_longitude": order.delivery_longitude,
            "total_amount": float(order.total_amount),
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "customer_notes": order.customer_notes,
            "vendor_store": store_data,
            "distance_km": round(distance, 2)
        })
        
    return APIResponse(success=True, data=data)


@router.post("/orders/{order_id}/accept", response_model=APIResponse)
async def accept_order(
    order_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually accept/claim an unassigned nearby order."""
    boy = await _get_delivery_boy(current_user["user_id"], db)

    if boy.status != DeliveryBoyStatus.ACTIVE:
        raise HTTPException(
            status_code=403,
            detail="Your KYC verification is incomplete. Please wait for admin approval."
        )
    
    if boy.availability == AvailabilityStatus.OFFLINE:
        raise HTTPException(status_code=400, detail="You must be online to accept orders")
        
    if boy.current_order_count >= boy.max_concurrent_orders:
        raise HTTPException(status_code=400, detail="You have reached your maximum concurrent orders limit")

    # Fetch order
    res = await db.execute(
        select(Order).where(Order.id == order_id, Order.delivery_boy_id == None, Order.is_deleted == False)
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or already assigned")

    # Verify status is accepted/packed and option is auto
    meta = order.metadata_json or {}
    if order.status not in [OrderStatus.ACCEPTED, OrderStatus.PACKED] or meta.get("delivery_option") != "auto":
        raise HTTPException(
            status_code=400,
            detail="This order is not ready for platform delivery (requires vendor acceptance & platform delivery option)"
        )

    # If boy is private, verify it belongs to their vendor
    if boy.vendor_id and order.vendor_id != boy.vendor_id:
        raise HTTPException(status_code=403, detail="You can only accept orders from your assigned vendor")

    # Accept the order
    order.delivery_boy_id = boy.user_id
    
    # If order is in ACCEPTED, update to ASSIGNED
    old_status = order.status
    if old_status == OrderStatus.ACCEPTED:
        order.status = OrderStatus.ASSIGNED
        
    boy.current_order_count += 1
    boy.availability = AvailabilityStatus.ON_DELIVERY
    
    # Record history
    from app.models.order import OrderStatusHistory
    history = OrderStatusHistory(
        order_id=order_id,
        from_status=old_status.value,
        to_status=order.status.value,
        changed_by=current_user["user_id"],
        changed_by_type="delivery_boy",
        notes="Order accepted manually by delivery agent",
    )
    db.add(history)
    await db.flush()
    await db.commit()
    
    # Broadcast ws update
    try:
        from app.websocket.manager import ws_manager
        ws_payload = {
            "type": "order_status_update",
            "data": {
                "order_id": str(order_id),
                "order_number": order.order_number,
                "status": order.status.value,
                "delivery_boy_id": str(boy.user_id),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        await ws_manager.send_to_user(order.user_id, ws_payload)
    except Exception:
        pass

    return APIResponse(success=True, message="Order accepted successfully")


from app.api.schemas import ItemRejectionRequest
from app.models.product import Inventory, InventoryLog

@router.post("/orders/{order_id}/reject-items", response_model=APIResponse)
async def reject_order_items(
    order_id: UUID,
    body: ItemRejectionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Allow delivery agent to partially reject items at the doorstep.
    Calculates refunded amount and adjusts the total order value and COD.
    """
    # Verify assignment
    res = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.delivery_boy_id == current_user["user_id"], Order.is_deleted == False)
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=403, detail="Order not found or not assigned to you")

    if order.status not in [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.PICKED]:
        raise HTTPException(status_code=400, detail="Items can only be rejected when the order is out for delivery")

    total_refund_amount = 0.0
    rejected_log = []

    # Process each rejected item
    for rejection in body.rejected_items:
        # Find the order item
        item = next((i for i in order.items if i.product_id == rejection.product_id and i.variant_id == rejection.variant_id), None)
        if not item:
            raise HTTPException(status_code=400, detail=f"Item with product_id {rejection.product_id} not found in order")

        if rejection.rejected_quantity > item.quantity:
            raise HTTPException(status_code=400, detail=f"Cannot reject more than ordered quantity for {item.product_name}")

        # Calculate value of rejected items
        rejected_value = float(item.unit_price) * rejection.rejected_quantity
        total_refund_amount += rejected_value

        # Update order item quantity and total price
        item.quantity -= rejection.rejected_quantity
        item.total_price = float(item.unit_price) * item.quantity

        # Restore inventory
        inv_res = await db.execute(
            select(Inventory).where(
                Inventory.vendor_id == order.vendor_id,
                Inventory.product_id == item.product_id,
                Inventory.variant_id == item.variant_id,
                Inventory.is_deleted == False
            )
        )
        inventory = inv_res.scalars().first()
        if inventory:
            inventory.quantity += rejection.rejected_quantity
            
            # Create InventoryLog
            inv_log = InventoryLog(
                inventory_id=inventory.id,
                vendor_id=order.vendor_id,
                change_type="rejection_refund",
                quantity_change=rejection.rejected_quantity,
                quantity_before=inventory.quantity - rejection.rejected_quantity,
                quantity_after=inventory.quantity,
                reference_type="order",
                reference_id=str(order.id),
                notes=f"Item rejected at delivery. Reason: {rejection.reason}"
            )
            db.add(inv_log)

        rejected_log.append({
            "product_name": item.product_name,
            "quantity": rejection.rejected_quantity,
            "value": rejected_value,
            "reason": rejection.reason
        })

    if total_refund_amount <= 0:
        return APIResponse(success=True, message="No changes made to the order")

    # Update order totals
    order.subtotal = float(order.subtotal) - total_refund_amount
    
    # Recalculate tax proportionally (simple approach, assumes uniform tax rate)
    original_subtotal = float(order.subtotal) + total_refund_amount
    tax_ratio = float(order.tax_amount) / original_subtotal if original_subtotal > 0 else 0
    tax_reduction = total_refund_amount * tax_ratio
    order.tax_amount = float(order.tax_amount) - tax_reduction

    # The new total amount is reduced by the refund and tax reduction
    order.total_amount = float(order.total_amount) - (total_refund_amount + tax_reduction)

    # Process refund or COD adjustment
    refund_message = ""
    if order.payment_method == "cod":
        refund_message = f"COD amount reduced by ₹{total_refund_amount + tax_reduction:.2f}."
    else:
        # If paid online, initiate wallet refund
        from app.services.payment_service import PaymentService
        from app.models.payment import WalletTransactionType
        payment_service = PaymentService(db)
        await payment_service.credit_wallet(
            user_id=order.user_id,
            amount=total_refund_amount + tax_reduction,
            txn_type=WalletTransactionType.REFUND,
            reference_type="order",
            reference_id=str(order.id),
            description=f"Refund for rejected items in order {order.order_number}"
        )
        refund_message = f"₹{total_refund_amount + tax_reduction:.2f} refunded to customer's wallet."

    from typing import Any
    # Update metadata
    meta: dict[str, Any] = dict(order.metadata_json) if order.metadata_json else {}
    existing_rejections = meta.get("rejected_items", [])
    if not isinstance(existing_rejections, list):
        existing_rejections = []
    existing_rejections.extend(rejected_log)
    meta["rejected_items"] = existing_rejections
    meta["partial_rejection"] = True
    order.metadata_json = meta

    # Add system note
    from app.models.order import OrderStatusHistory
    history = OrderStatusHistory(
        order_id=order_id,
        from_status=order.status.value,
        to_status=order.status.value,
        changed_by=current_user["user_id"],
        changed_by_type="delivery_boy",
        notes=f"Customer rejected items worth ₹{total_refund_amount:.2f}. {refund_message}",
    )
    db.add(history)

    await db.flush()
    await db.commit()

    return APIResponse(success=True, message=f"Order updated successfully. {refund_message}")
