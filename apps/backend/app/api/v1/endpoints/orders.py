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


@router.post("/", response_model=APIResponse, status_code=201)
async def place_order(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
    vendor_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Place a new order from active cart."""
    service = OrderService(db)
    try:
        order, pay_info = await service.place_order(
            user_id=current_user["user_id"],
            vendor_id=vendor_id,
            address_id=body.address_id,
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


@router.get("/", response_model=PaginatedResponse[OrderResponse])
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
    role = current_user.get("role", "customer")
    if role == "customer":
        query = query.where(Order.user_id == current_user["user_id"])
    elif role in ["vendor", "vendor_manager"]:
        from app.models.vendor import Vendor
        vendor_res = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"]))
        vendor = vendor_res.scalars().first()
        if not vendor:
            raise HTTPException(status_code=403, detail="Vendor profile required")
        query = query.where(Order.vendor_id == vendor.id)
    elif role == "delivery_boy":
        query = query.where(Order.delivery_boy_id == current_user["user_id"])

    if status_filter:
        query = query.where(Order.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_items = await db.scalar(count_query) or 0

    # Limit / Offset
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query.options(selectinload(Order.items)))
    orders = result.scalars().all()

    total_pages = (total_items + page_size - 1) // page_size

    return PaginatedResponse(
        success=True,
        data=[OrderResponse.model_validate(o) for o in orders],
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

    # Visibility check
    role = current_user.get("role", "customer")
    if role == "customer" and order.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    elif role == "delivery_boy" and order.delivery_boy_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return APIResponse(success=True, data=OrderResponse.model_validate(order))


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
            user_type=current_user.get("role", "customer"),
            notes=body.notes
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
            user_type=current_user.get("role", "customer"),
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
