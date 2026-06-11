"""
Delivery Boy operations and assignment tracking API endpoints.
"""
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

    try:
        await service.update_order_status(
            order_id=order_id,
            status=OrderStatus.DELIVERED,
            changed_by=current_user["user_id"],
            user_type="delivery_boy",
            notes="Delivered with OTP verification"
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
