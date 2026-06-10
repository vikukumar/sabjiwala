"""
Wallets & Transactions API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, WalletTopUp
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.payment import Wallet, WalletTransaction, WalletTransactionType, PaymentGateway
from app.services.payment_service import PaymentService

router = APIRouter()


@router.get("", response_model=APIResponse)
async def get_wallet_details(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve wallet balance and transaction summary."""
    service = PaymentService(db)
    # Check roles to map user type
    role = current_user.get("role", "customer")
    
    from app.models.payment import WalletType
    w_type = WalletType.CUSTOMER
    if role in ["vendor", "vendor_manager"]:
        w_type = WalletType.VENDOR
    elif role == "delivery_boy":
        w_type = WalletType.DELIVERY

    wallet = await service.get_or_create_wallet(current_user["user_id"], wallet_type=w_type)
    return APIResponse(
        success=True,
        data={
            "id": str(wallet.id),
            "balance": float(wallet.balance),
            "pending_balance": float(wallet.pending_balance),
            "total_credited": float(wallet.total_credited),
            "total_debited": float(wallet.total_debited),
        }
    )


@router.get("/transactions", response_model=APIResponse)
async def get_wallet_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List wallet transactions for current user."""
    # Find wallet
    service = PaymentService(db)
    wallet = await service.get_or_create_wallet(current_user["user_id"])

    # Fetch transactions
    query = (
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id, WalletTransaction.is_deleted == False)
        .order_by(desc(WalletTransaction.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    txns = result.scalars().all()

    data = []
    for t in txns:
        data.append({
            "id": str(t.id),
            "transaction_type": t.transaction_type.value,
            "amount": float(t.amount),
            "balance_before": float(t.balance_before),
            "balance_after": float(t.balance_after),
            "reference_type": t.reference_type,
            "reference_id": t.reference_id,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        })

    return APIResponse(success=True, data=data)


@router.post("/top-up", response_model=APIResponse)
async def top_up_wallet(
    body: WalletTopUp,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate a top-up payment for the customer's wallet."""
    from app.models.payment import PaymentGateway
    service = PaymentService(db)
    
    gateway_param = PaymentGateway(body.gateway)
    payment_info = await service.initiate_payment(
        order_id=None,
        user_id=current_user["user_id"],
        amount=body.amount,
        gateway=gateway_param
    )
    
    await db.commit()
    return APIResponse(
        success=True,
        message="Wallet top-up transaction initiated",
        data=payment_info
    )
