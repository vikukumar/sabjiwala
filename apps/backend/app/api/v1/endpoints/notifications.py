"""
Notifications API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, NotificationResponse, PushSubscriptionCreate
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.notification import Notification, PushSubscription

router = APIRouter()


@router.get("/", response_model=APIResponse[List[NotificationResponse]])
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve personal notifications list with pagination."""
    query = (
        select(Notification)
        .where(Notification.user_id == current_user["user_id"], Notification.is_deleted == False)
        .order_by(desc(Notification.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return APIResponse(
        success=True,
        data=[NotificationResponse.model_validate(n) for n in notifications]
    )


@router.post("/read", response_model=APIResponse)
async def mark_notifications_as_read(
    notification_id: Optional[UUID] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark personal notifications as read."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    query = update(Notification).where(
        Notification.user_id == current_user["user_id"],
        Notification.is_read == False,
        Notification.is_deleted == False
    )
    
    if notification_id:
        query = query.where(Notification.id == notification_id)
        
    await db.execute(query.values(is_read=True, read_at=now))
    await db.commit()
    
    return APIResponse(success=True, message="Notifications marked as read")


@router.post("/subscriptions", response_model=APIResponse)
async def subscribe_web_push(
    body: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register client web push subscription."""
    # Check if subscription already exists
    exist_res = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user["user_id"],
            PushSubscription.endpoint == body.endpoint
        )
    )
    sub = exist_res.scalars().first()
    
    if sub:
        sub.p256dh_key = body.p256dh_key
        sub.auth_key = body.auth_key
        sub.is_active = True
    else:
        sub = PushSubscription(
            user_id=current_user["user_id"],
            endpoint=body.endpoint,
            p256dh_key=body.p256dh_key,
            auth_key=body.auth_key,
            device_type=body.device_type,
            is_active=True,
        )
        db.add(sub)
        
    await db.commit()
    return APIResponse(success=True, message="Web push subscription saved successfully")
