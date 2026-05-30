"""
Super Admin dashboard and oversight endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, PaginatedResponse, PaginationMeta, SystemSettingUpdate
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.user import User, UserType
from app.models.vendor import Vendor, VendorStatus
from app.models.system import SystemSetting
from app.services.analytics_service import AnalyticsService

router = APIRouter()


async def _verify_admin(current_user: dict):
    """Ensure user is an administrator."""
    if current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied. Administrator access required.")


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
                # Add to UserRole
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
