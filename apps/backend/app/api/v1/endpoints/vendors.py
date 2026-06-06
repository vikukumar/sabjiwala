"""
Vendor management endpoints — registration, store, documents, service areas, delivery rules, staff.
"""
import re
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, DeliveryRuleCreate, PaginatedResponse, PaginationMeta,
    ServiceAreaCreate, StoreTimingsUpdate, VendorRegisterRequest, VendorResponse,
)
from app.core.rbac.engine import get_current_user, rbac_engine
from app.db.session import get_db
from app.models.user import User, UserRole, UserType, Role
from app.models.vendor import (
    Vendor, VendorBankAccount, VendorDeliveryRule, VendorDocument,
    VendorHoliday, VendorServiceArea, VendorStaff, VendorStatus,
    VendorStore, VendorWallet,
)

router = APIRouter()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text


@router.post("/register", response_model=APIResponse[VendorResponse], status_code=201)
async def register_vendor(
    body: VendorRegisterRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register as a vendor (existing user becomes vendor)."""
    user_id = current_user["user_id"]

    # Check if already a vendor
    existing = await db.execute(select(Vendor).where(Vendor.user_id == user_id, Vendor.is_deleted == False))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Already registered as a vendor")

    # Create vendor
    import secrets
    slug = _slugify(body.business_name) + "-" + secrets.token_hex(3)

    vendor = Vendor(
        user_id=user_id,
        business_name=body.business_name,
        business_type=body.business_type,
        slug=slug,
        description=body.description,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        gst_number=body.gst_number,
        pan_number=body.pan_number,
        status=VendorStatus.PENDING,
    )
    db.add(vendor)
    await db.flush()

    # Create default store
    store = VendorStore(
        vendor_id=vendor.id,
        store_name=body.business_name,
    )
    db.add(store)

    # Create vendor wallet
    wallet = VendorWallet(vendor_id=vendor.id)
    db.add(wallet)

    # Update user type
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()
    if user:
        user.user_type = UserType.VENDOR

    # Assign vendor role
    role_result = await db.execute(select(Role).where(Role.name == "vendor"))
    vendor_role = role_result.scalars().first()
    if vendor_role:
        user_role = UserRole(user_id=user_id, role_id=vendor_role.id)
        db.add(user_role)

    await db.flush()

    return APIResponse(success=True, message="Vendor registered. Pending verification.", data=VendorResponse.model_validate(vendor))


@router.get("/me", response_model=APIResponse[VendorResponse])
async def get_my_vendor_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current vendor's profile."""
    result = await db.execute(
        select(Vendor)
        .options(selectinload(Vendor.store))
        .where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False)
    )
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return APIResponse(success=True, data=VendorResponse.model_validate(vendor))


@router.get("/me/metrics", response_model=APIResponse)
async def get_my_vendor_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current vendor's sales and order metrics."""
    result = await db.execute(
        select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False)
    )
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
        
    from app.services.analytics_service import AnalyticsService
    service = AnalyticsService(db)
    metrics = await service.get_vendor_dashboard_metrics(vendor.id)
    return APIResponse(success=True, data=metrics)


@router.patch("/me", response_model=APIResponse[VendorResponse])
async def update_vendor_profile(
    body: VendorRegisterRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor profile."""
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(vendor, field):
            setattr(vendor, field, value)

    await db.flush()
    return APIResponse(success=True, message="Profile updated", data=VendorResponse.model_validate(vendor))


@router.put("/me/store/timings", response_model=APIResponse)
async def update_store_timings(
    body: StoreTimingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update store operating timings."""
    result = await db.execute(
        select(Vendor).options(selectinload(Vendor.store))
        .where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False)
    )
    vendor = result.scalars().first()
    if not vendor or not vendor.store:
        raise HTTPException(status_code=404, detail="Store not found")

    vendor.store.store_timings = body.store_timings
    await db.flush()
    return APIResponse(success=True, message="Store timings updated")


@router.post("/me/service-areas", response_model=APIResponse, status_code=201)
async def create_service_area(
    body: ServiceAreaCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a delivery service area (radius or polygon)."""
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    area = VendorServiceArea(
        vendor_id=vendor.id,
        name=body.name,
        radius_km=body.radius_km,
        center_latitude=body.center_latitude,
        center_longitude=body.center_longitude,
        polygon_geojson=body.polygon_geojson,
    )
    db.add(area)
    await db.flush()
    return APIResponse(success=True, message="Service area created")


@router.post("/me/delivery-rules", response_model=APIResponse, status_code=201)
async def create_delivery_rule(
    body: DeliveryRuleCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set delivery charge rules."""
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    rule = VendorDeliveryRule(vendor_id=vendor.id, **body.model_dump())
    db.add(rule)
    await db.flush()
    return APIResponse(success=True, message="Delivery rule created")


@router.get("/me/service-areas", response_model=APIResponse)
async def get_my_service_areas(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current vendor's service areas."""
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    area_result = await db.execute(
        select(VendorServiceArea).where(VendorServiceArea.vendor_id == vendor.id, VendorServiceArea.is_deleted == False)
    )
    areas = area_result.scalars().all()
    return APIResponse(success=True, data=[
        {
            "id": str(area.id),
            "name": area.name,
            "radius_km": area.radius_km,
            "center_latitude": area.center_latitude,
            "center_longitude": area.center_longitude,
            "polygon_geojson": area.polygon_geojson,
            "is_active": area.is_active,
        }
        for area in areas
    ])


@router.get("/me/delivery-rules", response_model=APIResponse)
async def get_my_delivery_rules(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current vendor's delivery rules."""
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    rule_result = await db.execute(
        select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor.id, VendorDeliveryRule.is_deleted == False)
    )
    rules = rule_result.scalars().all()
    return APIResponse(success=True, data=[
        {
            "id": str(rule.id),
            "min_order_amount": float(rule.min_order_amount),
            "free_delivery_above": float(rule.free_delivery_above) if rule.free_delivery_above is not None else None,
            "base_delivery_charge": float(rule.base_delivery_charge),
            "per_km_charge": float(rule.per_km_charge),
            "max_delivery_distance_km": rule.max_delivery_distance_km,
            "distance_slabs": rule.distance_slabs,
        }
        for rule in rules
    ])


# ===== Admin vendor management =====

@router.get("/", response_model=PaginatedResponse[VendorResponse])
async def list_vendors(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all vendors (admin/customer view)."""
    query = select(Vendor).where(Vendor.is_deleted == False)

    if status:
        query = query.where(Vendor.status == status)
    if search:
        query = query.where(Vendor.business_name.ilike(f"%{search}%"))

    # For customers, only show approved vendors
    if current_user["user_type"] == "customer":
        query = query.where(Vendor.status == VendorStatus.APPROVED)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Vendor.created_at.desc())
    result = await db.execute(query)
    vendors = result.scalars().all()
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        data=[VendorResponse.model_validate(v) for v in vendors],
        pagination=PaginationMeta(page=page, page_size=page_size, total_items=total, total_pages=total_pages, has_next=page < total_pages, has_previous=page > 1),
    )


@router.patch("/{vendor_id}/verify", response_model=APIResponse)
async def verify_vendor(
    vendor_id: UUID,
    action: str,  # approve or reject
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a vendor (admin only)."""
    has_perm = await rbac_engine.has_permission(current_user["user_id"], "vendors.verify", db)
    if not has_perm:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id, Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    from datetime import datetime, timezone
    if action == "approve":
        vendor.status = VendorStatus.APPROVED
        vendor.approved_at = datetime.now(timezone.utc)
        vendor.approved_by = current_user["user_id"]
        message = "Vendor approved"
    elif action == "reject":
        vendor.status = VendorStatus.REJECTED
        vendor.rejection_reason = reason
        message = "Vendor rejected"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    await db.flush()
    return APIResponse(success=True, message=message)
