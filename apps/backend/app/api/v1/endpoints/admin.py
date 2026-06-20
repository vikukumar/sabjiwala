"""
Super Admin dashboard and oversight endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    APIResponse, PaginatedResponse, PaginationMeta, SystemSettingUpdate,
    UpdateUserStatusRequest, UpdateUserRoleRequest, UpdateVendorCommissionRequest,
    UpdateDeliveryBoyStatusRequest, AdvertisementCreate,
    CmsPageCreateUpdate, EmailTemplateCreateUpdate, EmailTemplateTestRequest
)
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.user import User, UserType
from app.models.vendor import Vendor, VendorStatus
from app.models.system import SystemSetting
from app.services.analytics_service import AnalyticsService

router = APIRouter()


async def _verify_admin(current_user: dict):
    """Ensure user is an administrator or support agent."""
    if current_user.get("user_type") not in ["admin", "super_admin", "support_agent"]:
        raise HTTPException(status_code=403, detail="Permission denied. Administrator or support agent access required.")


@router.get("/metrics", response_model=APIResponse)
async def get_platform_metrics(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch administrative platform metrics summary."""
    await _verify_admin(current_user)
    service = AnalyticsService(db)
    metrics = await service.get_admin_dashboard_metrics()
    return APIResponse(success=True, data=metrics)


@router.post("/vendors/{vendor_id}/verify", response_model=APIResponse)
async def verify_vendor(
    vendor_id: UUID,
    status: str = Query(...), # approved, rejected
    reason: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject a vendor registration KYC."""
    await _verify_admin(current_user)

    res = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = res.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    new_status = VendorStatus(status)
    vendor.status = new_status
    vendor.rejection_reason = reason
    
    if new_status == VendorStatus.APPROVED:
        from datetime import datetime, timezone
        vendor.approved_at = datetime.now(timezone.utc)
        vendor.approved_by = current_user["user_id"]

        # Activate the associated user profile verification status
        user_res = await db.execute(select(User).where(User.id == vendor.user_id))
        user = user_res.scalars().first()
        if user:
            user.is_verified = True
            # Assign vendor role if not done
            from sqlalchemy import select as sa_select
            from app.models.user import Role, UserRole
            role_result = await db.execute(sa_select(Role).where(Role.name == "vendor"))
            vendor_role = role_result.scalars().first()
            if vendor_role:
                # Check if this role is already assigned (even if soft-deleted) to avoid duplicate key errors
                existing_role_res = await db.execute(
                    sa_select(UserRole).where(
                        UserRole.user_id == user.id,
                        UserRole.role_id == vendor_role.id
                    )
                )
                existing_user_role = existing_role_res.scalars().first()
                if existing_user_role:
                    if existing_user_role.is_deleted:
                        existing_user_role.is_deleted = False
                        existing_user_role.deleted_at = None
                        existing_user_role.deleted_by = None
                else:
                    db.add(UserRole(user_id=user.id, role_id=vendor_role.id))


    await db.commit()
    return APIResponse(success=True, message=f"Vendor status updated to {new_status.value}")


@router.get("/settings", response_model=APIResponse)
async def get_system_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve system-wide config variables."""
    await _verify_admin(current_user)
    res = await db.execute(select(SystemSetting))
    settings = res.scalars().all()
    
    data = {s.key: s.value_json if s.value_json else s.value for s in settings}
    return APIResponse(success=True, data=data)


@router.patch("/settings/{key}", response_model=APIResponse)
async def update_system_setting(
    key: str,
    body: SystemSettingUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a system config variable."""
    await _verify_admin(current_user)
    
    res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = res.scalars().first()
    if not setting:
        # Create new
        setting = SystemSetting(key=key, value=body.value, value_json=body.value_json)
        db.add(setting)
    else:
        if body.value is not None:
            setting.value = body.value
        if body.value_json is not None:
            setting.value_json = body.value_json

    await db.commit()
    return APIResponse(success=True, message=f"System setting '{key}' updated successfully")


@router.get("/schema-logs", response_model=APIResponse)
async def get_schema_logs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve database schema evolution logs."""
    await _verify_admin(current_user)
    from sqlalchemy import text
    try:
        result = await db.execute(text("SELECT id, change_type, table_name, description, applied_at FROM _schema_evolution_log ORDER BY applied_at DESC LIMIT 50"))
        logs = [
            {
                "id": str(r[0]),
                "type": r[1],
                "table": r[2] or "",
                "desc": r[3],
                "date": r[4].isoformat() if r[4] else ""
            }
            for r in result.fetchall()
        ]
    except Exception as e:
        logs = []
    return APIResponse(success=True, data=logs)


@router.get("/vendors/pending", response_model=APIResponse)
async def get_pending_vendors(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List vendors with pending KYC details."""
    await _verify_admin(current_user)
    result = await db.execute(
        select(Vendor)
        .where(Vendor.status.in_([VendorStatus.PENDING, VendorStatus.DOCUMENTS_SUBMITTED, VendorStatus.UNDER_REVIEW]))
    )
    vendors = result.scalars().all()
    data = []
    for v in vendors:
        user_res = await db.execute(select(User).where(User.id == v.user_id))
        user = user_res.scalars().first()
        data.append({
            "id": str(v.id),
            "name": v.business_name,
            "contact": user.email if user else (v.contact_email or "No Email"),
            "docType": "GST/FSSAI Certificate" if v.gst_number or v.fssai_number else "KYC Document",
            "time": v.created_at.isoformat()
        })
    return APIResponse(success=True, data=data)


@router.get("/vendors/{vendor_id}", response_model=APIResponse)
async def get_vendor_details(
    vendor_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve complete vendor details including FSSAI/PAN/GST and documents for admin review."""
    await _verify_admin(current_user)
    
    from sqlalchemy.orm import selectinload
    from app.models.vendor import VendorDocument
    
    result = await db.execute(
        select(Vendor)
        .options(selectinload(Vendor.store))
        .where(Vendor.id == vendor_id)
    )
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    user_res = await db.execute(select(User).where(User.id == vendor.user_id))
    user = user_res.scalars().first()
    
    # Fetch documents
    doc_res = await db.execute(select(VendorDocument).where(VendorDocument.vendor_id == vendor.id))
    documents = doc_res.scalars().all()
    
    data = {
        "id": str(vendor.id),
        "business_name": vendor.business_name,
        "business_type": vendor.business_type,
        "description": vendor.description,
        "status": vendor.status.value,
        "rejection_reason": vendor.rejection_reason,
        "gst_number": vendor.gst_number,
        "pan_number": vendor.pan_number,
        "fssai_number": vendor.fssai_number,
        "contact_email": user.email if user else vendor.contact_email,
        "contact_phone": user.phone if user else vendor.contact_phone,
        "created_at": vendor.created_at.isoformat(),
        "store": {
            "store_name": vendor.store.store_name if vendor.store else "",
            "city": vendor.store.city if vendor.store else "",
            "state": vendor.store.state if vendor.store else "",
        } if vendor.store else None,
        "documents": [
            {
                "id": str(d.id),
                "document_type": d.document_type.value,
                "document_number": d.document_number,
                "file_url": d.file_url,
                "verification_status": d.verification_status.value
            }
            for d in documents
        ]
    }
    return APIResponse(success=True, data=data)


@router.get("/users", response_model=APIResponse)
async def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users with role and search query filtering."""
    await _verify_admin(current_user)
    
    # Base query
    stmt = select(User).where(User.is_deleted == False)
    
    # Filter by user type if specified
    if role:
        stmt = stmt.where(User.user_type == role)
        
    # Search filter
    if search:
        search_filter = f"%{search}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(search_filter),
                User.last_name.ilike(search_filter),
                User.email.ilike(search_filter),
                User.phone.ilike(search_filter),
                User.username.ilike(search_filter)
            )
        )
        
    # Order by creation date descending
    stmt = stmt.order_by(User.created_at.desc())
    
    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count_res = await db.execute(count_stmt)
    total_items = total_count_res.scalar_one()
    
    # Paginate
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # Transform
    user_list = []
    for u in users:
        user_list.append({
            "id": str(u.id),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "phone": u.phone,
            "username": u.username,
            "user_type": u.user_type.value if hasattr(u.user_type, "value") else str(u.user_type),
            "is_active": u.is_active,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat() if u.created_at else ""
        })
        
    total_pages = (total_items + page_size - 1) // page_size
    pagination = {
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1
    }
    
    return APIResponse(success=True, data=user_list, meta={"pagination": pagination})


@router.patch("/users/{user_id}/status", response_model=APIResponse)
async def update_user_status(
    user_id: UUID,
    body: UpdateUserStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable or block user access."""
    await _verify_admin(current_user)
    
    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = body.is_active
    await db.commit()
    
    return APIResponse(success=True, message=f"User status updated to {'active' if body.is_active else 'blocked'}")


@router.patch("/users/{user_id}/role", response_model=APIResponse)
async def update_user_role(
    user_id: UUID,
    body: UpdateUserRoleRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role and automatically initialize missing profiles, stores, and wallets."""
    await _verify_admin(current_user)
    
    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_role = body.role
    if new_role not in ["customer", "vendor", "delivery_boy", "admin", "support_agent"]:
        raise HTTPException(status_code=400, detail="Invalid role type specified")
        
    # Map to UserType enum
    from app.models.user import UserType, Role, UserRole
    role_map = {
        "customer": UserType.CUSTOMER,
        "vendor": UserType.VENDOR,
        "delivery_boy": UserType.DELIVERY_BOY,
        "admin": UserType.ADMIN,
        "support_agent": UserType.SUPPORT_AGENT
    }
    user.user_type = role_map[new_role]
    
    # Sync UserRoles table
    role_res = await db.execute(select(Role).where(Role.name == new_role))
    db_role = role_res.scalars().first()
    if db_role:
        # Clear/Update existing user roles
        await db.execute(update(UserRole).where(UserRole.user_id == user.id).values(role_id=db_role.id))
        # If no UserRole entry existed, insert one
        ur_check = await db.execute(select(UserRole).where(UserRole.user_id == user.id))
        if not ur_check.scalars().first():
            db.add(UserRole(user_id=user.id, role_id=db_role.id))
            
    # Initialize missing profiles/wallets as requested by user
    import secrets
    if user.user_type == UserType.SUPPORT_AGENT:
        from app.models.support import SupportAgentProfile
        ap_res = await db.execute(select(SupportAgentProfile).where(SupportAgentProfile.user_id == user.id))
        if not ap_res.scalars().first():
            db.add(SupportAgentProfile(user_id=user.id, is_available=True))
            
    if user.user_type == UserType.VENDOR:

        from app.models.vendor import Vendor, VendorWallet, VendorStatus, VendorStore
        
        # Check if Vendor profile exists
        v_res = await db.execute(select(Vendor).where(Vendor.user_id == user.id))
        vendor = v_res.scalars().first()
        if not vendor:
            vendor = Vendor(
                user_id=user.id,
                business_name=f"{user.first_name} {user.last_name}'s Store",
                business_type="individual",
                slug=f"{user.first_name.lower()}-{user.last_name.lower()}-{secrets.token_hex(4)}",
                status=VendorStatus.APPROVED,
                contact_email=user.email,
                contact_phone=user.phone
            )
            db.add(vendor)
            await db.flush()
            
        # Check if VendorStore exists
        vs_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == vendor.id))
        if not vs_res.scalars().first():
            store = VendorStore(
                vendor_id=vendor.id,
                store_name=vendor.business_name
            )
            db.add(store)
            
        # Check if VendorWallet exists
        vw_res = await db.execute(select(VendorWallet).where(VendorWallet.vendor_id == vendor.id))
        if not vw_res.scalars().first():
            db.add(VendorWallet(vendor_id=vendor.id))
            
    elif user.user_type == UserType.DELIVERY_BOY:
        from app.models.delivery import DeliveryBoy, DeliveryBoyStatus, AvailabilityStatus, DeliveryWallet
        from app.models.payment import Wallet, WalletType
        
        # Check if DeliveryBoy profile exists
        db_res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.user_id == user.id))
        delivery_boy = db_res.scalars().first()
        if not delivery_boy:
            delivery_boy = DeliveryBoy(
                user_id=user.id,
                status=DeliveryBoyStatus.ACTIVE,
                availability=AvailabilityStatus.OFFLINE,
                vehicle_type="motorcycle"
            )
            db.add(delivery_boy)
            await db.flush()
            
        # Check if general delivery wallet exists
        w_res = await db.execute(select(Wallet).where(Wallet.user_id == user.id, Wallet.wallet_type == WalletType.DELIVERY))
        if not w_res.scalars().first():
            db.add(Wallet(user_id=user.id, wallet_type=WalletType.DELIVERY))
            
        # Check if DeliveryWallet exists
        dw_res = await db.execute(select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == delivery_boy.id))
        if not dw_res.scalars().first():
            db.add(DeliveryWallet(delivery_boy_id=delivery_boy.id))
            
    elif user.user_type == UserType.CUSTOMER:
        from app.models.payment import Wallet, WalletType
        w_res = await db.execute(select(Wallet).where(Wallet.user_id == user.id, Wallet.wallet_type == WalletType.CUSTOMER))
        if not w_res.scalars().first():
            db.add(Wallet(user_id=user.id, wallet_type=WalletType.CUSTOMER))
            
    await db.commit()
    return APIResponse(success=True, message=f"User role updated to {new_role} and missing profiles/wallets initialized.")


@router.get("/vendors", response_model=APIResponse)
async def list_vendors(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all vendors with business details, ratings, orders, commissions, and KYC stats."""
    await _verify_admin(current_user)
    
    from sqlalchemy.orm import selectinload
    stmt = select(Vendor).options(selectinload(Vendor.store)).where(Vendor.is_deleted == False)
    if search:
        search_filter = f"%{search}%"
        stmt = stmt.where(Vendor.business_name.ilike(search_filter))
        
    stmt = stmt.order_by(Vendor.created_at.desc())
    result = await db.execute(stmt)
    vendors = result.scalars().all()
    
    vendor_list = []
    for v in vendors:
        user_res = await db.execute(select(User).where(User.id == v.user_id))
        user = user_res.scalars().first()
        
        # Fetch delivery rules
        from app.models.vendor import VendorDeliveryRule
        rule_res = await db.execute(select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == v.id))
        rule = rule_res.scalars().first()
        
        vendor_list.append({
            "id": str(v.id),
            "business_name": v.business_name,
            "business_type": v.business_type,
            "description": v.description,
            "status": v.status.value if hasattr(v.status, "value") else str(v.status),
            "commission_rate": v.commission_rate,
            "gst_number": v.gst_number,
            "pan_number": v.pan_number,
            "fssai_number": v.fssai_number,
            "contact_email": user.email if user else v.contact_email,
            "contact_phone": user.phone if user else v.contact_phone,
            "average_rating": v.average_rating,
            "total_orders": v.total_orders,
            "latitude": v.store.latitude if v.store else None,
            "longitude": v.store.longitude if v.store else None,
            "created_at": v.created_at.isoformat() if v.created_at else "",
            # Include individual delivery rules so admin can configure them
            "min_order_amount": float(rule.min_order_amount) if rule and rule.min_order_amount is not None else 0.0,
            "free_delivery_above": float(rule.free_delivery_above) if rule and rule.free_delivery_above is not None else None,
            "base_delivery_charge": float(rule.base_delivery_charge) if rule and rule.base_delivery_charge is not None else 0.0,
            "per_km_charge": float(rule.per_km_charge) if rule and rule.per_km_charge is not None else 0.0,
            "max_delivery_distance_km": float(rule.max_delivery_distance_km) if rule and rule.max_delivery_distance_km is not None else 10.0,
            "packaging_fee": float(rule.packaging_fee) if rule and rule.packaging_fee is not None else 0.0,
            "free_platform_fee_above": float(rule.free_platform_fee_above) if rule and rule.free_platform_fee_above is not None else None,
        })
        
    return APIResponse(success=True, data=vendor_list)


@router.patch("/vendors/{vendor_id}/commission", response_model=APIResponse)
async def update_vendor_settings(
    vendor_id: UUID,
    body: UpdateVendorCommissionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update vendor settings: commission rate, business metadata, and custom delivery rules."""
    await _verify_admin(current_user)
    
    # 1. Update Vendor table fields
    res = await db.execute(select(Vendor).where(Vendor.id == vendor_id, Vendor.is_deleted == False))
    vendor = res.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
        
    vendor.commission_rate = body.commission_rate
    
    if body.business_name is not None:
        vendor.business_name = body.business_name
    if body.business_type is not None:
        vendor.business_type = body.business_type
    if body.description is not None:
        vendor.description = body.description
    if body.gst_number is not None:
        vendor.gst_number = body.gst_number
    if body.pan_number is not None:
        vendor.pan_number = body.pan_number
    if body.fssai_number is not None:
        vendor.fssai_number = body.fssai_number
        
    # 2. Update VendorStore store_name if business name is updated
    if body.business_name is not None:
        from app.models.vendor import VendorStore
        vs_res = await db.execute(select(VendorStore).where(VendorStore.vendor_id == vendor.id))
        store = vs_res.scalars().first()
        if store:
            store.store_name = body.business_name
            
    # 3. Update or Create VendorDeliveryRule
    from app.models.vendor import VendorDeliveryRule
    rule_res = await db.execute(select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor_id))
    rule = rule_res.scalars().first()
    
    # Check if we need to update any delivery rule fields
    has_rule_updates = any(
        v is not None for v in [
            body.min_order_amount,
            body.free_delivery_above,
            body.base_delivery_charge,
            body.per_km_charge,
            body.max_delivery_distance_km,
            body.packaging_fee,
            body.free_platform_fee_above
        ]
    )
    
    if has_rule_updates:
        if not rule:
            rule = VendorDeliveryRule(vendor_id=vendor_id)
            db.add(rule)
            
        if body.min_order_amount is not None:
            rule.min_order_amount = body.min_order_amount
        if body.free_delivery_above is not None:
            rule.free_delivery_above = body.free_delivery_above
        if body.base_delivery_charge is not None:
            rule.base_delivery_charge = body.base_delivery_charge
        if body.per_km_charge is not None:
            rule.per_km_charge = body.per_km_charge
        if body.max_delivery_distance_km is not None:
            rule.max_delivery_distance_km = body.max_delivery_distance_km
        if body.packaging_fee is not None:
            rule.packaging_fee = body.packaging_fee
        if body.free_platform_fee_above is not None:
            rule.free_platform_fee_above = body.free_platform_fee_above
            
    await db.commit()
    return APIResponse(success=True, message="Vendor settings updated successfully")


@router.get("/delivery-boys", response_model=APIResponse)
async def list_delivery_boys(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all delivery boy profiles with vehicle details, active stats, and statuses."""
    await _verify_admin(current_user)
    
    from app.models.delivery import DeliveryBoy
    stmt = select(DeliveryBoy).where(DeliveryBoy.is_deleted == False)
    
    result = await db.execute(stmt)
    boys = result.scalars().all()
    
    boy_list = []
    for b in boys:
        user_res = await db.execute(select(User).where(User.id == b.user_id))
        user = user_res.scalars().first()
        
        if not user:
            continue
            
        if search:
            search_lower = search.lower()
            full_name = f"{user.first_name} {user.last_name}".lower()
            if (
                search_lower not in full_name and
                search_lower not in (user.email or "").lower() and
                search_lower not in (user.phone or "").lower() and
                search_lower not in (b.license_number or "").lower()
            ):
                continue
                
        # Fetch KYC documents for this delivery boy
        from app.models.storage import FileMetadata
        doc_res = await db.execute(
            select(FileMetadata).where(
                FileMetadata.entity_type == "delivery_kyc",
                FileMetadata.entity_id == str(b.id)
            )
        )
        docs = doc_res.scalars().all()
        kyc_docs = [
            {
                "id": str(d.id),
                "document_type": d.custom_metadata.get("document_type") if d.custom_metadata else "Document",
                "file_url": f"/api/v1/storage/{d.id}",
                "original_filename": d.original_filename
            }
            for d in docs
        ]

        boy_list.append({
            "id": str(b.id),
            "user_id": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "phone": user.phone,
            "status": b.status.value if hasattr(b.status, "value") else str(b.status),
            "availability": b.availability.value if hasattr(b.availability, "value") else str(b.availability),
            "vehicle_type": b.vehicle_type,
            "vehicle_number": b.vehicle_number,
            "license_number": b.license_number,
            "total_deliveries": b.total_deliveries,
            "average_rating": b.average_rating,
            "latitude": b.current_latitude,
            "longitude": b.current_longitude,
            "created_at": b.created_at.isoformat() if b.created_at else "",
            "kyc_documents": kyc_docs
        })
        
    return APIResponse(success=True, data=boy_list)


@router.patch("/delivery-boys/{delivery_boy_id}/status", response_model=APIResponse)
async def update_delivery_boy_status(
    delivery_boy_id: UUID,
    body: UpdateDeliveryBoyStatusRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a delivery boy's status (active, inactive, suspended, on_leave)."""
    await _verify_admin(current_user)
    
    from app.models.delivery import DeliveryBoy, DeliveryBoyStatus
    res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.id == delivery_boy_id, DeliveryBoy.is_deleted == False))
    boy = res.scalars().first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy profile not found")
        
    try:
        boy.status = DeliveryBoyStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status value. Must be one of active, inactive, suspended, on_leave.")
        
    await db.commit()
    return APIResponse(success=True, message=f"Delivery boy status updated to {body.status}")


@router.post("/delivery-boys/{delivery_boy_id}/approve", response_model=APIResponse)
async def approve_delivery_boy_kyc(
    delivery_boy_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a delivery boy's KYC registration."""
    await _verify_admin(current_user)
    
    from app.models.delivery import DeliveryBoy, DeliveryBoyStatus
    res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.id == delivery_boy_id, DeliveryBoy.is_deleted == False))
    boy = res.scalars().first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy profile not found")
        
    boy.status = DeliveryBoyStatus.ACTIVE
    
    # Verify associated user
    user_res = await db.execute(select(User).where(User.id == boy.user_id))
    user = user_res.scalars().first()
    if user:
        user.is_verified = True
        
        # Assign delivery_boy role if not done
        from sqlalchemy import select as sa_select
        from app.models.user import Role, UserRole
        role_result = await db.execute(sa_select(Role).where(Role.name == "delivery_boy"))
        db_role = role_result.scalars().first()
        if db_role:
            existing_role_res = await db.execute(
                sa_select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == db_role.id
                )
            )
            existing_user_role = existing_role_res.scalars().first()
            if existing_user_role:
                if existing_user_role.is_deleted:
                    existing_user_role.is_deleted = False
                    existing_user_role.deleted_at = None
                    existing_user_role.deleted_by = None
            else:
                db.add(UserRole(user_id=user.id, role_id=db_role.id))
                
    await db.commit()
    return APIResponse(success=True, message="Delivery boy KYC approved successfully")


@router.post("/delivery-boys/{delivery_boy_id}/reject", response_model=APIResponse)
async def reject_delivery_boy_kyc(
    delivery_boy_id: UUID,
    body: Optional[dict] = None,
    reason: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a delivery boy's KYC registration."""
    await _verify_admin(current_user)
    
    from app.models.delivery import DeliveryBoy, DeliveryBoyStatus
    res = await db.execute(select(DeliveryBoy).where(DeliveryBoy.id == delivery_boy_id, DeliveryBoy.is_deleted == False))
    boy = res.scalars().first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy profile not found")
        
    boy.status = DeliveryBoyStatus.SUSPENDED
    
    rej_reason = (body or {}).get("reason") or reason or "Documents verification failed"
    await db.commit()
    return APIResponse(success=True, message=f"Delivery boy KYC rejected: {rej_reason}")



# ---- Coupon & Banner CMS Management ----
from app.models.coupon import Coupon, CouponType, CouponScope
from app.models.cms import Banner, CmsPage
from app.api.schemas import CouponCreate, BannerCreate, CmsPageCreate

@router.get("/coupons", response_model=APIResponse)
async def list_admin_coupons(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all coupons for admin panel."""
    await _verify_admin(current_user)
    
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    coupons = result.scalars().all()
    
    data = [
        {
            "id": str(c.id),
            "code": c.code,
            "name": c.name,
            "description": c.description,
            "coupon_type": c.coupon_type.value if hasattr(c.coupon_type, "value") else str(c.coupon_type),
            "discount_value": c.discount_value,
            "max_discount_amount": float(c.max_discount_amount) if c.max_discount_amount else None,
            "min_order_amount": float(c.min_order_amount),
            "max_total_uses": c.max_total_uses,
            "max_uses_per_user": c.max_uses_per_user,
            "current_uses": c.current_uses,
            "starts_at": c.starts_at.isoformat() if c.starts_at else None,
            "expires_at": c.expires_at.isoformat() if c.expires_at else None,
            "is_active": c.is_active,
            "vendor_id": str(c.vendor_id) if c.vendor_id else None,
        }
        for c in coupons
    ]
    return APIResponse(success=True, data=data)


@router.post("/coupons", response_model=APIResponse)
async def create_admin_coupon(
    body: CouponCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new global or store coupon."""
    await _verify_admin(current_user)
    
    # Check duplicate code
    dup_res = await db.execute(select(Coupon).where(Coupon.code == body.code.upper()))
    if dup_res.scalars().first():
        raise HTTPException(status_code=400, detail=f"Coupon with code '{body.code}' already exists")

    coupon = Coupon(
        code=body.code.upper(),
        name=body.name,
        description=body.description,
        coupon_type=CouponType(body.coupon_type),
        scope=CouponScope.PLATFORM, # Default admin coupons to platform
        discount_value=body.discount_value,
        max_discount_amount=body.max_discount_amount,
        min_order_amount=body.min_order_amount,
        max_total_uses=body.max_total_uses,
        max_uses_per_user=body.max_uses_per_user,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        is_active=True,
    )
    db.add(coupon)
    await db.commit()
    
    return APIResponse(success=True, message=f"Coupon '{body.code}' created successfully")


@router.delete("/coupons/{coupon_id}", response_model=APIResponse)
async def delete_admin_coupon(
    coupon_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate or delete a coupon."""
    await _verify_admin(current_user)
    
    res = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = res.scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
        
    coupon.is_active = False
    await db.commit()
    return APIResponse(success=True, message="Coupon deactivated successfully")


@router.get("/banners", response_model=APIResponse)
async def list_admin_banners(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all layout banners for admin panel."""
    await _verify_admin(current_user)
    
    result = await db.execute(select(Banner).order_by(Banner.sort_order.asc(), Banner.created_at.desc()))
    banners = result.scalars().all()
    
    data = [
        {
            "id": str(b.id),
            "title": b.title,
            "subtitle": b.subtitle,
            "image_url": b.image_url,
            "mobile_image_url": b.mobile_image_url,
            "action_url": b.action_url,
            "action_type": b.action_type,
            "position": b.position,
            "sort_order": b.sort_order,
            "is_active": b.is_active,
            "starts_at": b.starts_at.isoformat() if b.starts_at else None,
            "expires_at": b.expires_at.isoformat() if b.expires_at else None,
        }
        for b in banners
    ]
    return APIResponse(success=True, data=data)


@router.post("/banners", response_model=APIResponse)
async def create_admin_banner(
    body: BannerCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new promotional layout banner."""
    await _verify_admin(current_user)
    
    banner = Banner(
        title=body.title,
        subtitle=body.subtitle,
        image_url=body.image_url,
        mobile_image_url=body.mobile_image_url,
        action_url=body.action_url,
        action_type=body.action_type,
        position=body.position,
        sort_order=body.sort_order,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        is_active=True,
    )
    db.add(banner)
    await db.commit()
    
    return APIResponse(success=True, message="Banner created successfully")


@router.delete("/banners/{banner_id}", response_model=APIResponse)
async def delete_admin_banner(
    banner_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate or remove a promotional banner."""
    await _verify_admin(current_user)
    
    res = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = res.scalars().first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
        
    await db.delete(banner)
    await db.commit()
    return APIResponse(success=True, message="Banner deleted successfully")


@router.get("/ads", response_model=APIResponse)
async def list_admin_ads(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all advertisements and popup modals for admin portal."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    res = await db.execute(select(Advertisement).order_by(Advertisement.created_at.desc()))
    ads = res.scalars().all()
    
    data = [
        {
            "id": str(a.id),
            "name": a.name,
            "description": a.description,
            "advertiser_name": a.advertiser_name,
            "image_url": a.image_url,
            "click_url": a.click_url,
            "placement": a.placement,
            "video_url": getattr(a, "video_url", None),
            "page_target": a.page_target,
            "position": getattr(a, "position", None),
            "is_active": a.is_active,
            "starts_at": a.starts_at,
            "expires_at": a.expires_at,
        }
        for a in ads
    ]
    return APIResponse(success=True, data=data)


@router.post("/ads", response_model=APIResponse)
async def create_admin_ad(
    body: AdvertisementCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new advertisement or popup campaign."""
    await _verify_admin(current_user)
    from app.api.schemas import AdvertisementCreate
    from app.models.cms import Advertisement
    
    ad = Advertisement(
        name=body.name,
        description=body.description,
        advertiser_name=body.advertiser_name,
        image_url=body.image_url,
        click_url=body.click_url,
        placement=body.placement,
        video_url=body.video_url,
        page_target=body.page_target,
        position=body.position,
        target_categories=body.target_categories or [],
        target_locations=body.target_locations or [],
        is_active=body.is_active,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
    )
    db.add(ad)
    await db.commit()
    return APIResponse(success=True, message="Advertisement created successfully", data={"id": str(ad.id)})


@router.delete("/ads/{ad_id}", response_model=APIResponse)
async def delete_admin_ad(
    ad_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete/remove an advertisement."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    
    res = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = res.scalars().first()
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
        
    await db.delete(ad)
    await db.commit()
    return APIResponse(success=True, message="Advertisement deleted successfully")


@router.get("/notification-templates", response_model=APIResponse)
async def list_notification_templates(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all notification and email templates."""
    await _verify_admin(current_user)
    
    from app.models.notification import NotificationTemplate
    from app.services.notification_service import NotificationService
    service = NotificationService(db)
    await service.seed_default_templates()
    await db.commit()
    
    result = await db.execute(select(NotificationTemplate).order_by(NotificationTemplate.event_key.asc()))
    templates = result.scalars().all()
    
    data = [
        {
            "id": str(t.id),
            "name": t.name,
            "event_key": t.event_key,
            "in_app_title": t.in_app_title,
            "in_app_body": t.in_app_body,
            "email_subject": t.email_subject,
            "email_body": t.email_body,
            "sms_body": t.sms_body,
            "push_title": t.push_title,
            "push_body": t.push_body,
            "channels": t.channels or [],
            "is_active": t.is_active,
        }
        for t in templates
    ]
    return APIResponse(success=True, data=data)


from pydantic import BaseModel
class AdminTemplateUpdateSchema(BaseModel):
    name: str
    in_app_title: Optional[str] = None
    in_app_body: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    sms_body: Optional[str] = None
    push_title: Optional[str] = None
    push_body: Optional[str] = None
    channels: List[str] = []
    is_active: bool = True


@router.put("/notification-templates/{template_id}", response_model=APIResponse)
async def update_notification_template(
    template_id: UUID,
    body: AdminTemplateUpdateSchema,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a notification/email template details."""
    await _verify_admin(current_user)
    
    from app.models.notification import NotificationTemplate
    res = await db.execute(select(NotificationTemplate).where(NotificationTemplate.id == template_id))
    template = res.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    template.name = body.name
    template.in_app_title = body.in_app_title
    template.in_app_body = body.in_app_body
    template.email_subject = body.email_subject
    template.email_body = body.email_body
    template.sms_body = body.sms_body
    template.push_title = body.push_title
    template.push_body = body.push_body
    template.channels = body.channels
    template.is_active = body.is_active
    
    await db.commit()
    return APIResponse(success=True, message="Template updated successfully")


@router.get("/settings", response_model=APIResponse)
async def list_system_settings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all system settings for admin dashboard."""
    await _verify_admin(current_user)
    
    from app.api.v1.endpoints.installation import seed_system_settings
    await seed_system_settings(db)
    await db.commit()

    res = await db.execute(select(SystemSetting).order_by(SystemSetting.key.asc()))
    settings = res.scalars().all()
    
    data = [
        {
            "key": s.key,
            "value": s.value,
            "value_json": s.value_json,
            "value_type": s.value_type,
            "group": s.group,
            "description": s.description,
            "is_public": s.is_public,
            "is_editable": s.is_editable,
        }
        for s in settings
    ]
    return APIResponse(success=True, data=data)


@router.put("/settings/{key}", response_model=APIResponse)
@router.patch("/settings/{key}", response_model=APIResponse)
async def update_system_setting(
    key: str,
    body: SystemSettingUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a system setting value/json."""
    await _verify_admin(current_user)
    
    res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = res.scalars().first()
    if not setting:
        raise HTTPException(status_code=404, detail="System setting not found")
        
    if not setting.is_editable:
        raise HTTPException(status_code=400, detail="This setting is not editable")
        
    setting.value = body.value
    setting.value_json = body.value_json
    
    await db.commit()
    
    from app.core.config import apply_system_settings_overrides
    await apply_system_settings_overrides(db)
    
    return APIResponse(success=True, message=f"Setting '{key}' updated successfully")


@router.get("/returns", response_model=APIResponse)
async def list_admin_returns(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all customer return requests."""
    await _verify_admin(current_user)
    
    from app.models.order import ReturnRequest, Order
    
    result = await db.execute(select(ReturnRequest).order_by(desc(ReturnRequest.created_at)))
    return_reqs = result.scalars().all()
    
    data = []
    for r in return_reqs:
        user_res = await db.execute(select(User).where(User.id == r.user_id))
        user = user_res.scalars().first()
        
        order_res = await db.execute(select(Order).where(Order.id == r.order_id))
        order = order_res.scalars().first()
        
        data.append({
            "id": str(r.id),
            "order_id": str(r.order_id),
            "order_number": order.order_number if order else "Unknown",
            "customer_name": f"{user.first_name} {user.last_name}" if user else "Customer",
            "customer_phone": user.phone if user else "",
            "reason": r.reason,
            "images": r.images or [],
            "return_items": r.return_items or [],
            "refund_amount": float(r.refund_amount) if r.refund_amount is not None else 0.0,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
        
    return APIResponse(success=True, data=data)


@router.post("/returns/{return_id}/approve", response_model=APIResponse)
async def approve_return_request(
    return_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a return request, processing refund."""
    await _verify_admin(current_user)
    
    from app.models.order import ReturnRequest, ReturnStatus, Order, OrderStatus
    
    res = await db.execute(select(ReturnRequest).where(ReturnRequest.id == return_id))
    ret_req = res.scalars().first()
    if not ret_req:
        raise HTTPException(status_code=404, detail="Return request not found")
        
    ret_req.status = ReturnStatus.APPROVED
    
    order_res = await db.execute(select(Order).where(Order.id == ret_req.order_id))
    order = order_res.scalars().first()
    if order:
        order.status = OrderStatus.RETURNED
        
    await db.commit()
    return APIResponse(success=True, message="Return request approved successfully")


@router.post("/returns/{return_id}/reject", response_model=APIResponse)
async def reject_return_request(
    return_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a return request."""
    await _verify_admin(current_user)
    
    from app.models.order import ReturnRequest, ReturnStatus
    
    res = await db.execute(select(ReturnRequest).where(ReturnRequest.id == return_id))
    ret_req = res.scalars().first()
    if not ret_req:
        raise HTTPException(status_code=404, detail="Return request not found")
        
    ret_req.status = ReturnStatus.REJECTED
    await db.commit()
    return APIResponse(success=True, message="Return request rejected successfully")


@router.get("/ads", response_model=APIResponse)
async def list_admin_ads(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all ads for administration."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    
    stmt = select(Advertisement).order_by(Advertisement.created_at.desc())
    res = await db.execute(stmt)
    ads = res.scalars().all()
    
    data = [
        {
            "id": str(a.id),
            "name": a.name,
            "description": a.description,
            "advertiser_name": a.advertiser_name,
            "image_url": a.image_url,
            "click_url": a.click_url,
            "placement": a.placement,
            "video_url": getattr(a, "video_url", None),
            "page_target": a.page_target,
            "position": getattr(a, "position", None),
            "is_active": a.is_active,
            "starts_at": a.starts_at.isoformat() if a.starts_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        }
        for a in ads
    ]
    return APIResponse(success=True, data=data)


@router.post("/ads", response_model=APIResponse)
async def create_admin_ad(
    ad_data: AdvertisementCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new advertisement."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    
    ad = Advertisement(
        name=ad_data.name,
        description=ad_data.description,
        advertiser_name=ad_data.advertiser_name,
        image_url=ad_data.image_url,
        click_url=ad_data.click_url,
        placement=ad_data.placement,
        video_url=ad_data.video_url,
        page_target=ad_data.page_target,
        position=ad_data.position,
        target_categories=ad_data.target_categories,
        target_locations=ad_data.target_locations,
        is_active=ad_data.is_active,
        starts_at=ad_data.starts_at,
        expires_at=ad_data.expires_at,
    )
    db.add(ad)
    await db.commit()
    await db.refresh(ad)
    return APIResponse(success=True, message="Advertisement created successfully", data={"id": str(ad.id)})


@router.put("/ads/{ad_id}", response_model=APIResponse)
async def update_admin_ad(
    ad_id: UUID,
    ad_data: AdvertisementCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing advertisement."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    
    res = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = res.scalars().first()
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
        
    ad.name = ad_data.name
    ad.description = ad_data.description
    ad.advertiser_name = ad_data.advertiser_name
    ad.image_url = ad_data.image_url
    ad.click_url = ad_data.click_url
    ad.placement = ad_data.placement
    ad.video_url = ad_data.video_url
    ad.page_target = ad_data.page_target
    ad.position = ad_data.position
    ad.target_categories = ad_data.target_categories
    ad.target_locations = ad_data.target_locations
    ad.is_active = ad_data.is_active
    ad.starts_at = ad_data.starts_at
    ad.expires_at = ad_data.expires_at
    
    await db.commit()
    return APIResponse(success=True, message="Advertisement updated successfully")


@router.delete("/ads/{ad_id}", response_model=APIResponse)
async def delete_admin_ad(
    ad_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an advertisement."""
    await _verify_admin(current_user)
    from app.models.cms import Advertisement
    
    res = await db.execute(select(Advertisement).where(Advertisement.id == ad_id))
    ad = res.scalars().first()
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
        
    await db.delete(ad)
    await db.commit()
    return APIResponse(success=True, message="Advertisement deleted successfully")


@router.post("/agents", response_model=APIResponse)
async def create_support_agent(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new Support Agent account directly."""
    await _verify_admin(current_user)
    
    email = body.get("email")
    phone = body.get("phone")
    password = body.get("password")
    first_name = body.get("first_name", "Support")
    last_name = body.get("last_name", "Agent")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
        
    # Check existing user
    exist_res = await db.execute(select(User).where(User.email == email))
    if exist_res.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")
        
    from app.core.security.password import hash_password
    from app.models.user import Role, UserRole, UserProfile
    from app.models.support import SupportAgentProfile
    
    agent_user = User(
        email=email,
        phone=phone,
        username=email.split("@")[0],
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        user_type=UserType.SUPPORT_AGENT,
        is_active=True,
        is_verified=True,
        is_email_verified=True,
    )
    db.add(agent_user)
    await db.flush()
    
    profile = UserProfile(user_id=agent_user.id)
    db.add(profile)
    
    role_res = await db.execute(select(Role).where(Role.name == "support_agent"))
    role = role_res.scalars().first()
    if role:
        db.add(UserRole(user_id=agent_user.id, role_id=role.id))
        
    agent_profile = SupportAgentProfile(
        user_id=agent_user.id,
        is_available=True,
        voicemails=[]
    )
    db.add(agent_profile)
    
    await db.commit()
    return APIResponse(
        success=True,
        message="Support Agent created successfully",
        data={"id": str(agent_user.id), "email": agent_user.email}
    )


# ===== CMS Page Endpoints =====

@router.get("/pages", response_model=APIResponse)
async def list_admin_pages(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all CMS pages for administrative oversight."""
    await _verify_admin(current_user)
    from app.models.cms import CmsPage
    res = await db.execute(select(CmsPage).order_by(CmsPage.sort_order.asc()))
    pages = res.scalars().all()
    
    data = [
        {
            "id": p.id,
            "slug": p.slug,
            "title": p.title,
            "content": p.content,
            "content_html": p.content_html,
            "meta_title": p.meta_title,
            "meta_description": p.meta_description,
            "is_published": p.is_published,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "page_type": p.page_type,
            "sort_order": p.sort_order,
        }
        for p in pages
    ]
    return APIResponse(success=True, data=data)


@router.get("/pages/{slug}", response_model=APIResponse)
async def get_admin_page(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detail of a single CMS page."""
    await _verify_admin(current_user)
    from app.models.cms import CmsPage
    res = await db.execute(select(CmsPage).where(CmsPage.slug == slug))
    p = res.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
        
    data = {
        "id": p.id,
        "slug": p.slug,
        "title": p.title,
        "content": p.content,
        "content_html": p.content_html,
        "meta_title": p.meta_title,
        "meta_description": p.meta_description,
        "is_published": p.is_published,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "page_type": p.page_type,
        "sort_order": p.sort_order,
    }
    return APIResponse(success=True, data=data)


@router.post("/pages", response_model=APIResponse)
async def create_admin_page(
    body: CmsPageCreateUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new CMS page."""
    await _verify_admin(current_user)
    from app.models.cms import CmsPage
    from datetime import datetime, timezone
    
    res = await db.execute(select(CmsPage).where(CmsPage.slug == body.slug))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Page with this slug already exists")
        
    p = CmsPage(
        slug=body.slug,
        title=body.title,
        content=body.content,
        content_html=body.content_html or body.content,
        meta_title=body.meta_title,
        meta_description=body.meta_description,
        is_published=body.is_published,
        published_at=datetime.now(timezone.utc) if body.is_published else None,
        page_type=body.page_type,
        sort_order=body.sort_order,
    )
    db.add(p)
    await db.commit()
    return APIResponse(success=True, message="CMS page created successfully", data={"slug": p.slug})


@router.put("/pages/{slug}", response_model=APIResponse)
async def update_admin_page(
    slug: str,
    body: CmsPageCreateUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing CMS page."""
    await _verify_admin(current_user)
    from app.models.cms import CmsPage
    from datetime import datetime, timezone
    
    res = await db.execute(select(CmsPage).where(CmsPage.slug == slug))
    p = res.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
        
    # Check if slug is changing and already exists
    if body.slug != slug:
        dup_res = await db.execute(select(CmsPage).where(CmsPage.slug == body.slug))
        if dup_res.scalars().first():
            raise HTTPException(status_code=400, detail="Page with new slug already exists")
            
    p.slug = body.slug
    p.title = body.title
    p.content = body.content
    p.content_html = body.content_html or body.content
    p.meta_title = body.meta_title
    p.meta_description = body.meta_description
    
    if body.is_published and not p.is_published:
        p.published_at = datetime.now(timezone.utc)
    elif not body.is_published:
        p.published_at = None
        
    p.is_published = body.is_published
    p.page_type = body.page_type
    p.sort_order = body.sort_order
    
    await db.commit()
    return APIResponse(success=True, message="CMS page updated successfully")


@router.delete("/pages/{slug}", response_model=APIResponse)
async def delete_admin_page(
    slug: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a CMS page."""
    await _verify_admin(current_user)
    from app.models.cms import CmsPage
    res = await db.execute(select(CmsPage).where(CmsPage.slug == slug))
    p = res.scalars().first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
        
    await db.delete(p)
    await db.commit()
    return APIResponse(success=True, message="CMS page deleted successfully")


# ===== Email Template Endpoints =====

@router.get("/email-templates", response_model=APIResponse)
async def list_admin_email_templates(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all email templates."""
    await _verify_admin(current_user)
    from app.models.cms import EmailTemplate
    res = await db.execute(select(EmailTemplate).order_by(EmailTemplate.name.asc()))
    templates = res.scalars().all()
    
    data = [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "subject": t.subject,
            "body_html": t.body_html,
            "body_text": t.body_text,
            "variables": t.variables or [],
            "is_active": t.is_active,
            "category": t.category,
        }
        for t in templates
    ]
    return APIResponse(success=True, data=data)


@router.post("/email-templates", response_model=APIResponse)
async def create_admin_email_template(
    body: EmailTemplateCreateUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new email template."""
    await _verify_admin(current_user)
    from app.models.cms import EmailTemplate
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.slug == body.slug))
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Template with this slug already exists")
        
    t = EmailTemplate(
        name=body.name,
        slug=body.slug,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        variables=body.variables or [],
        is_active=body.is_active,
        category=body.category,
    )
    db.add(t)
    await db.commit()
    return APIResponse(success=True, message="Email template created successfully", data={"slug": t.slug})


@router.put("/email-templates/{slug}", response_model=APIResponse)
async def update_admin_email_template(
    slug: str,
    body: EmailTemplateCreateUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing email template."""
    await _verify_admin(current_user)
    from app.models.cms import EmailTemplate
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.slug == slug))
    t = res.scalars().first()
    if not t:
        raise HTTPException(status_code=404, detail="Email template not found")
        
    t.name = body.name
    t.slug = body.slug
    t.subject = body.subject
    t.body_html = body.body_html
    t.body_text = body.body_text
    t.variables = body.variables or []
    t.is_active = body.is_active
    t.category = body.category
    
    await db.commit()
    return APIResponse(success=True, message="Email template updated successfully")


@router.post("/email-templates/{slug}/test", response_model=APIResponse)
async def test_admin_email_template(
    slug: str,
    body: EmailTemplateTestRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test send an email template using custom variables and current SMTP settings."""
    await _verify_admin(current_user)
    from app.models.cms import EmailTemplate
    from app.models.notification import EmailQueue
    from app.services.notification_service import send_queued_email
    from jinja2 import Template
    
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.slug == slug))
    t = res.scalars().first()
    if not t:
        raise HTTPException(status_code=404, detail="Email template not found")
        
    try:
        # Render template elements
        subject_tpl = Template(t.subject)
        body_html_tpl = Template(t.body_html)
        
        rendered_subject = subject_tpl.render(**body.variables)
        rendered_body = body_html_tpl.render(**body.variables)
        rendered_text = Template(t.body_text or t.subject).render(**body.variables)
        
        email_q = EmailQueue(
            to_email=body.to_email,
            to_name="Test Recipient",
            subject=rendered_subject,
            body_html=rendered_body,
            body_text=rendered_text,
        )
        db.add(email_q)
        await db.flush()
        
        success = await send_queued_email(email_q)
        await db.commit()
        
        if success:
            return APIResponse(success=True, message=f"Test email successfully dispatched to {body.to_email}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to dispatch test email: {email_q.error_message}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rendering/sending test email: {str(e)}")



