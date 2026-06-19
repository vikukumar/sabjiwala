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
    VendorStore, VendorWallet, DocumentType, DocumentVerificationStatus
)

router = APIRouter()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text


async def _save_vendor_documents(db: AsyncSession, vendor_id: UUID, body: VendorRegisterRequest):
    docs_to_save = []
    if body.fssai_doc_url:
        docs_to_save.append((DocumentType.FSSAI_LICENSE, body.fssai_doc_url, body.fssai_number))
    if body.pan_doc_url:
        docs_to_save.append((DocumentType.PAN_CARD, body.pan_doc_url, body.pan_number))
    if body.gst_doc_url:
        docs_to_save.append((DocumentType.GST_CERTIFICATE, body.gst_doc_url, body.gst_number))
        
    for doc_type, url, doc_num in docs_to_save:
        # Check if already exists
        existing_res = await db.execute(
            select(VendorDocument).where(
                VendorDocument.vendor_id == vendor_id,
                VendorDocument.document_type == doc_type,
                VendorDocument.is_deleted == False
            )
        )
        existing = existing_res.scalars().first()
        if existing:
            existing.file_url = url
            existing.document_number = doc_num
            existing.verification_status = DocumentVerificationStatus.PENDING
        else:
            new_doc = VendorDocument(
                vendor_id=vendor_id,
                document_type=doc_type,
                document_number=doc_num,
                file_url=url,
                file_name=url.split("/")[-1] if "/" in url else "document",
                verification_status=DocumentVerificationStatus.PENDING
            )
            db.add(new_doc)


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

    # Fetch user for session fallback
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalars().first()

    # Create vendor
    import secrets
    slug = _slugify(body.business_name) + "-" + secrets.token_hex(3)

    # Use status from body if provided, else default to PENDING
    status = VendorStatus.PENDING
    if body.status:
        try:
            status = VendorStatus(body.status)
        except ValueError:
            pass

    vendor = Vendor(
        user_id=user_id,
        business_name=body.business_name,
        business_type=body.business_type,
        slug=slug,
        description=body.description,
        contact_email=body.contact_email or (user.email if user else None),
        contact_phone=body.contact_phone or (user.phone if user else None),
        gst_number=body.gst_number,
        pan_number=body.pan_number,
        fssai_number=body.fssai_number,
        status=status,
    )
    db.add(vendor)
    await db.flush()

    # Save documents
    await _save_vendor_documents(db, vendor.id, body)

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
    if user:
        user.user_type = UserType.VENDOR

    # Assign vendor role
    role_result = await db.execute(select(Role).where(Role.name == "vendor"))
    vendor_role = role_result.scalars().first()
    if vendor_role:
        user_role = UserRole(user_id=user_id, role_id=vendor_role.id)
        db.add(user_role)

    if vendor.store:
        vendor.store.service_radius_km = 10.0

    await db.flush()

    return APIResponse(success=True, message="Vendor registered. Pending verification.", data=VendorResponse.model_validate(vendor))


@router.get("/me", response_model=APIResponse[VendorResponse])
async def get_my_vendor_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current vendor's profile."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    if vendor.store:
        rule_res = await db.execute(
            select(VendorDeliveryRule.max_delivery_distance_km)
            .where(VendorDeliveryRule.vendor_id == vendor.id, VendorDeliveryRule.is_deleted == False)
        )
        radius = rule_res.scalar()
        if radius is None:
            area_res = await db.execute(
                select(VendorServiceArea.radius_km)
                .where(VendorServiceArea.vendor_id == vendor.id, VendorServiceArea.name == "Default", VendorServiceArea.is_deleted == False)
            )
            radius = area_res.scalar() or 10.0
        vendor.store.service_radius_km = float(radius)

    return APIResponse(success=True, data=VendorResponse.model_validate(vendor))


@router.get("/me/metrics", response_model=APIResponse)
async def get_my_vendor_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current vendor's sales and order metrics."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "status" and value:
            try:
                vendor.status = VendorStatus(value)
            except ValueError:
                pass
        elif hasattr(vendor, field):
            setattr(vendor, field, value)

    # Save documents if provided
    await _save_vendor_documents(db, vendor.id, body)

    if vendor.store:
        rule_res = await db.execute(
            select(VendorDeliveryRule.max_delivery_distance_km)
            .where(VendorDeliveryRule.vendor_id == vendor.id, VendorDeliveryRule.is_deleted == False)
        )
        radius = rule_res.scalar()
        if radius is None:
            area_res = await db.execute(
                select(VendorServiceArea.radius_km)
                .where(VendorServiceArea.vendor_id == vendor.id, VendorServiceArea.name == "Default", VendorServiceArea.is_deleted == False)
            )
            radius = area_res.scalar() or 10.0
        vendor.store.service_radius_km = float(radius)

    await db.flush()
    return APIResponse(success=True, message="Profile updated", data=VendorResponse.model_validate(vendor))


@router.put("/me/store/timings", response_model=APIResponse)
async def update_store_timings(
    body: StoreTimingsUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update store operating timings."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
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
            "packaging_fee": float(rule.packaging_fee) if rule.packaging_fee is not None else 0.0,
            "free_platform_fee_above": float(rule.free_platform_fee_above) if rule.free_platform_fee_above is not None else None,
            "distance_slabs": rule.distance_slabs,
        }
        for rule in rules
    ])


# ===== Admin vendor management =====

@router.get("", response_model=PaginatedResponse[VendorResponse])
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


# ===== Admin shortcut approve/reject/suspend routes =====

@router.post("/{vendor_id}/approve", response_model=APIResponse)
async def admin_approve_vendor(
    vendor_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    has_perm = await rbac_engine.has_permission(current_user["user_id"], "vendors.verify", db)
    if not has_perm:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id, Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    from datetime import datetime, timezone
    vendor.status = VendorStatus.APPROVED
    vendor.approved_at = datetime.now(timezone.utc)
    vendor.approved_by = current_user["user_id"]
    await db.flush()
    return APIResponse(success=True, message="Vendor approved successfully")


@router.post("/{vendor_id}/reject", response_model=APIResponse)
async def admin_reject_vendor(
    vendor_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    has_perm = await rbac_engine.has_permission(current_user["user_id"], "vendors.verify", db)
    if not has_perm:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id, Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.status = VendorStatus.REJECTED
    vendor.rejection_reason = body.get("reason", "")
    await db.flush()
    return APIResponse(success=True, message="Vendor rejected")


@router.post("/{vendor_id}/suspend", response_model=APIResponse)
async def admin_suspend_vendor(
    vendor_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    has_perm = await rbac_engine.has_permission(current_user["user_id"], "vendors.verify", db)
    if not has_perm:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id, Vendor.is_deleted == False))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.status = VendorStatus.SUSPENDED
    await db.flush()
    return APIResponse(success=True, message="Vendor suspended")


# ===== Vendor Store Location Update =====

@router.patch("/me/store/location", response_model=APIResponse)
async def update_store_location(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    store = vendor.store
    if not store:
        store = VendorStore(vendor_id=vendor.id, store_name=vendor.business_name)
        db.add(store)
        await db.flush()
        vendor.store = store
    if "latitude" in body:
        store.latitude = body["latitude"]
    if "longitude" in body:
        store.longitude = body["longitude"]
    if "address_line_1" in body:
        store.address_line_1 = body["address_line_1"]

    if "service_radius_km" in body:
        radius_km = float(body["service_radius_km"])
        
        # 1. Update or create default service area
        area_res = await db.execute(
            select(VendorServiceArea)
            .where(
                VendorServiceArea.vendor_id == vendor.id,
                VendorServiceArea.name == "Default",
                VendorServiceArea.is_deleted == False
            )
        )
        area = area_res.scalars().first()
        if not area:
            area = VendorServiceArea(
                vendor_id=vendor.id,
                name="Default",
                radius_km=radius_km,
                center_latitude=store.latitude,
                center_longitude=store.longitude
            )
            db.add(area)
        else:
            area.radius_km = radius_km
            area.center_latitude = store.latitude
            area.center_longitude = store.longitude

        # 2. Update or create default delivery rule
        rule_res = await db.execute(
            select(VendorDeliveryRule)
            .where(
                VendorDeliveryRule.vendor_id == vendor.id,
                VendorDeliveryRule.is_deleted == False
            )
        )
        rule = rule_res.scalars().first()
        if not rule:
            rule = VendorDeliveryRule(
                vendor_id=vendor.id,
                max_delivery_distance_km=radius_km,
                min_order_amount=0.0,
                base_delivery_charge=0.0,
                per_km_charge=0.0
            )
            db.add(rule)
        else:
            rule.max_delivery_distance_km = radius_km

    await db.flush()
    await db.commit()
    return APIResponse(success=True, message="Store location updated successfully")


# ===== Vendor Earnings =====

@router.get("/me/earnings", response_model=APIResponse)
async def get_vendor_earnings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    wallet_result = await db.execute(select(VendorWallet).where(VendorWallet.vendor_id == vendor.id))
    wallet = wallet_result.scalars().first()
    try:
        from app.models.order import Order
        from sqlalchemy import func as sqlfunc, cast
        from sqlalchemy.types import Date
        from datetime import date
        today = date.today()
        total_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Order.total_amount), 0))
            .where(Order.vendor_id == vendor.id, Order.status == "delivered")
        )
        total_earnings = float(total_result.scalar() or 0)
        today_result = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Order.total_amount), 0))
            .where(Order.vendor_id == vendor.id, Order.status == "delivered", cast(Order.created_at, Date) == today)
        )
        today_earnings = float(today_result.scalar() or 0)
        order_count_result = await db.execute(
            select(sqlfunc.count(Order.id)).where(Order.vendor_id == vendor.id, Order.status == "delivered")
        )
        total_orders = int(order_count_result.scalar() or 0)
    except Exception:
        total_earnings = today_earnings = 0.0
        total_orders = 0
    return APIResponse(success=True, data={
        "wallet_balance": float(getattr(wallet, "balance", 0) or 0),
        "total_earnings": total_earnings,
        "today_earnings": today_earnings,
        "pending_settlement": float(getattr(wallet, "pending_settlement", 0) or 0),
        "total_orders": total_orders,
    })


@router.get("/me/transactions", response_model=APIResponse)
async def get_vendor_transactions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return APIResponse(success=True, data=[])


@router.get("/me/analytics", response_model=APIResponse)
async def get_vendor_analytics(
    period: str = "30d",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    try:
        from app.services.analytics_service import AnalyticsService
        data = await AnalyticsService(db).get_vendor_analytics(vendor.id, period)
        return APIResponse(success=True, data=data)
    except Exception:
        return APIResponse(success=True, data={
            "total_revenue": 0, "total_orders": 0,
            "average_rating": float(vendor.average_rating or 0),
            "unique_customers": 0, "revenue_trend": [], "orders_trend": []
        })


@router.get("/me/top-products", response_model=APIResponse)
async def get_vendor_top_products(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    try:
        from app.services.analytics_service import AnalyticsService
        return APIResponse(success=True, data=await AnalyticsService(db).get_top_products(vendor.id, limit))
    except Exception:
        return APIResponse(success=True, data=[])


@router.post("/me/payout", response_model=APIResponse)
async def request_vendor_payout(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    wallet_result = await db.execute(select(VendorWallet).where(VendorWallet.vendor_id == vendor.id))
    wallet = wallet_result.scalars().first()
    amount = float(body.get("amount", 0))
    if amount < 100:
        raise HTTPException(status_code=400, detail="Minimum payout amount is Rs.100")
    bal = float(getattr(wallet, "balance", 0) or 0)
    if not wallet or bal < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    wallet.balance = bal - amount
    await db.flush()
    return APIResponse(success=True, message=f"Payout request of Rs.{amount:.2f} submitted.")


@router.get("/me/notifications", response_model=APIResponse)
async def get_vendor_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.models.notification import Notification
        query = select(Notification).where(Notification.user_id == current_user["user_id"])
        if unread_only:
            query = query.where(Notification.is_read == False)
        notif_result = await db.execute(query.order_by(Notification.created_at.desc()).limit(50))
        return APIResponse(success=True, data=[
            {
                "id": str(n.id), "title": n.title,
                "body": getattr(n, "body", None) or getattr(n, "message", ""),
                "is_read": n.is_read,
                "notification_type": getattr(n, "notification_type", "system"),
                "created_at": n.created_at.isoformat()
            }
            for n in notif_result.scalars().all()
        ])
    except Exception:
        return APIResponse(success=True, data=[])


@router.patch("/me/notifications/{notification_id}/read", response_model=APIResponse)
async def mark_vendor_notification_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.models.notification import Notification
        result = await db.execute(select(Notification).where(
            Notification.id == notification_id, Notification.user_id == current_user["user_id"]
        ))
        notif = result.scalars().first()
        if notif:
            notif.is_read = True
            await db.flush()
    except Exception:
        pass
    return APIResponse(success=True, message="Marked as read")


@router.post("/me/notifications/mark-all-read", response_model=APIResponse)
async def mark_all_vendor_notifications_read(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.models.notification import Notification
        from sqlalchemy import update
        await db.execute(
            update(Notification).where(Notification.user_id == current_user["user_id"]).values(is_read=True)
        )
        await db.flush()
    except Exception:
        pass
    return APIResponse(success=True, message="All notifications marked as read")
