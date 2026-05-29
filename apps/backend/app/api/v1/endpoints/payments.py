"""
Payments API endpoints.
"""
from typing import Dict, Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, PaymentInitiate, PaymentVerify, WalletTopUp
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.payment import Payment, PaymentStatus, PaymentGateway
from app.services.payment_service import PaymentService

logger = structlog.get_logger()
router = APIRouter()


@router.post("/initiate", response_model=APIResponse)
async def initiate_payment(
    body: PaymentInitiate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate online payment for an order."""
    service = PaymentService(db)
    
    # Verify order belongs to user
    from app.models.order import Order
    res = await db.execute(
        select(Order).where(Order.id == body.order_id, Order.user_id == current_user["user_id"])
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    gateway = PaymentGateway(body.gateway)
    try:
        payment_info = await service.initiate_payment(
            order_id=body.order_id,
            user_id=current_user["user_id"],
            amount=float(order.total_amount),
            gateway=gateway
        )
        return APIResponse(success=True, data=payment_info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify", response_model=APIResponse)
async def verify_payment(
    body: PaymentVerify,
    db: AsyncSession = Depends(get_db),
):
    """Verify payment signature from gateway and update order status."""
    service = PaymentService(db)

    # Find matching payment record
    res = await db.execute(
        select(Payment).where(
            Payment.gateway == PaymentGateway(body.gateway),
            Payment.gateway_order_id == body.gateway_order_id,
            Payment.status == PaymentStatus.PENDING
        )
    )
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pending payment record not found")

    is_valid = await service.verify_signature(
        gateway=body.gateway,
        gateway_order_id=body.gateway_order_id,
        gateway_payment_id=body.gateway_payment_id,
        gateway_signature=body.gateway_signature
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Confirm payment in database
    await service.confirm_payment(
        payment_id=payment.id,
        gateway_payment_id=body.gateway_payment_id,
        gateway_signature=body.gateway_signature,
        method=body.gateway,
    )

    await db.commit()
    return APIResponse(success=True, message="Payment verified successfully")


@router.post("/webhook/{gateway}")
async def gateway_webhook(
    gateway: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Asynchronous webhook handler for payment gateway notifications."""
    payload_bytes = await request.body()
    payload = await request.json()
    logger.info("Payment Webhook received", gateway=gateway, payload=payload)

    # In production, we'd verify the webhook signature header here
    # E.g. using Razorpay webhook secret. For simplicity, verify payload details.

    service = PaymentService(db)
    
    if gateway == "razorpay":
        event = payload.get("event")
        if event == "payment.captured":
            rp_payment = payload["payload"]["payment"]["entity"]
            rp_order_id = rp_payment["order_id"]
            rp_payment_id = rp_payment["id"]
            
            res = await db.execute(
                select(Payment).where(
                    Payment.gateway == PaymentGateway.RAZORPAY,
                    Payment.gateway_order_id == rp_order_id,
                    Payment.status == PaymentStatus.PENDING
                )
            )
            payment = res.scalars().first()
            if payment:
                await service.confirm_payment(
                    payment_id=payment.id,
                    gateway_payment_id=rp_payment_id,
                    method="razorpay_webhook",
                    method_details=rp_payment,
                )
                await db.commit()
                logger.info("Payment captured via Razorpay Webhook", order_id=str(payment.order_id))

    return {"status": "ok"}
