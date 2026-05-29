"""
Maps integration API endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.db.session import get_db
from app.services.map_service import MapService

router = APIRouter()


@router.get("/geocode", response_model=APIResponse)
async def geocode_address(
    q: str = Query(..., min_length=3),
    db: AsyncSession = Depends(get_db),
):
    """Geocode text address to coordinates."""
    service = MapService()
    result = await service.geocode(q)
    if not result:
        raise HTTPException(status_code=404, detail="Address not found or geocoding service timed out")
    return APIResponse(success=True, data=result)


@router.get("/reverse-geocode", response_model=APIResponse)
async def reverse_geocode_coords(
    lat: float = Query(...),
    lon: float = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Reverse geocode coordinates to text address."""
    service = MapService()
    address = await service.reverse_geocode(lat, lon)
    if not address:
        raise HTTPException(status_code=404, detail="Coordinates could not be mapped to an address")
    return APIResponse(success=True, data={"formatted_address": address})


@router.get("/distance", response_model=APIResponse)
async def calculate_distance(
    lat1: float = Query(...),
    lon1: float = Query(...),
    lat2: float = Query(...),
    lon2: float = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Calculate driving distance between two coordinates."""
    service = MapService()
    distance = await service.calculate_road_distance(lat1, lon1, lat2, lon2)
    return APIResponse(success=True, data={"distance_km": distance})
