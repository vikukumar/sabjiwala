"""
Coupons API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, CouponCreate, CouponApply, CouponResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.coupon import Coupon, CouponScope, CouponType
from app.services.coupon_engine import CouponEngine

router = APIRouter()


@router.post("/", response_model=APIResponse[CouponResponse], status_code=201)
async def create_coupon(
    body: CouponCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new promotional coupon (Admin/Vendor only)."""
    # Check permissions
    role = current_user.get("role", "customer")
    if role not in ["admin", "super_admin", "vendor", "vendor_manager"]:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Set scope
    scope = CouponScope.PLATFORM
    vendor_id = None
    if role in ["vendor", "vendor_manager"]:
        from app.models.vendor import Vendor
        vendor_res = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"]))
        vendor = vendor_res.scalars().first()
        if not vendor:
            raise HTTPException(status_code=403, detail="Vendor profile required")
        scope = CouponScope.VENDOR
        vendor_id = vendor.id

    coupon = Coupon(
        code=body.code.upper(),
        name=body.name,
        description=body.description,
        coupon_type=CouponType(body.coupon_type),
        scope=scope,
        discount_value=body.discount_value,
        max_discount_amount=body.max_discount_amount,
        min_order_amount=body.min_order_amount,
        max_total_uses=body.max_total_uses,
        max_uses_per_user=body.max_uses_per_user,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        vendor_id=vendor_id,
        is_active=True,
    )
    db.add(coupon)
    await db.flush()

    return APIResponse(
        success=True,
        message="Coupon created successfully",
        data=CouponResponse.model_validate(coupon)
    )


@router.get("/", response_model=APIResponse[List[CouponResponse]])
async def list_coupons(
    vendor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve list of active coupons."""
    query = select(Coupon).where(Coupon.is_active == True, Coupon.is_deleted == False)
    if vendor_id:
        query = query.where((Coupon.scope == CouponScope.PLATFORM) | (Coupon.vendor_id == vendor_id))
    else:
        query = query.where(Coupon.scope == CouponScope.PLATFORM)

    result = await db.execute(query)
    coupons = result.scalars().all()
    return APIResponse(success=True, data=[CouponResponse.model_validate(c) for c in coupons])


@router.post("/validate", response_model=APIResponse)
async def validate_coupon(
    body: CouponApply,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate a coupon against a shopping cart."""
    if not body.vendor_id:
        raise HTTPException(status_code=400, detail="vendor_id is required")

    engine = CouponEngine(db)
    validation = await engine.validate_coupon(
        code=body.code,
        user_id=current_user["user_id"],
        vendor_id=body.vendor_id,
    )

    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["message"])

    return APIResponse(success=True, message=validation["message"], data=validation)
