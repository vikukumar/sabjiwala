"""
Offers & Flash Sales API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.coupon import Offer, OfferType, OfferProduct

router = APIRouter()


@router.get("/", response_model=APIResponse)
async def list_active_offers(
    vendor_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List active marketing campaigns and store discounts."""
    query = select(Offer).where(Offer.is_active == True, Offer.is_deleted == False)
    if vendor_id:
        query = query.where((Offer.vendor_id == vendor_id) | (Offer.vendor_id == None))

    result = await db.execute(query)
    offers = result.scalars().all()
    
    data = []
    for offer in offers:
        data.append({
            "id": str(offer.id),
            "name": offer.name,
            "description": offer.description,
            "offer_type": offer.offer_type.value,
            "discount_percentage": offer.discount_percentage,
            "discount_amount": float(offer.discount_amount) if offer.discount_amount else None,
            "badge_text": offer.badge_text,
            "banner_image_url": offer.banner_image_url,
        })
        
    return APIResponse(success=True, data=data)
