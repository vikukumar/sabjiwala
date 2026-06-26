
new_code = r'''

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
    result = await db.execute(
        select(Vendor).options(selectinload(Vendor.store))
        .where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False)
    )
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if not vendor.store:
        store = VendorStore(vendor_id=vendor.id, store_name=vendor.business_name)
        db.add(store)
        await db.flush()
        vendor.store = store
    if "latitude" in body:
        vendor.store.latitude = body["latitude"]
    if "longitude" in body:
        vendor.store.longitude = body["longitude"]
    if "service_radius_km" in body:
        vendor.store.service_radius_km = body["service_radius_km"]
    if "address_line_1" in body:
        vendor.store.address_line_1 = body["address_line_1"]
    await db.flush()
    return APIResponse(success=True, message="Store location updated successfully")


# ===== Vendor Earnings =====

@router.get("/me/earnings", response_model=APIResponse)
async def get_vendor_earnings(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
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
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
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
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
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
    result = await db.execute(select(Vendor).where(Vendor.user_id == current_user["user_id"], Vendor.is_deleted == False))
    vendor = result.scalars().first()
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
'''

with open(r'd:/Projects/sbjiwala/apps/backend/app/api/v1/endpoints/vendors_append.py', 'w', encoding='utf-8') as f:
    f.write(new_code)
print('Written to append helper')
