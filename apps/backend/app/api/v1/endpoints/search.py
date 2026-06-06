"""
Search & Autocomplete API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, SearchQuery
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.services.search_service import SearchService

router = APIRouter()


@router.post("/", response_model=APIResponse)
async def run_search(
    body: SearchQuery,
    db: AsyncSession = Depends(get_db),
):
    """Search for products using full-text query matching."""
    service = SearchService(db)
    results = await service.search(
        query_str=body.q,
        category_id=body.category_id,
        vendor_id=body.vendor_id,
        limit=body.page_size,
        offset=(body.page - 1) * body.page_size
    )
    return APIResponse(success=True, data=results)


@router.get("/autocomplete", response_model=APIResponse)
async def autocomplete_suggestions(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve autocomplete prefix search suggestions."""
    # Autocomplete using search prefix
    service = SearchService(db)
    results = await service.search(query_str=q, limit=8)
    suggestions = [r["title"] for r in results]
    return APIResponse(success=True, data=suggestions)


@router.post("/reindex", response_model=APIResponse)
async def reindex_catalog(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Triggers database full rebuild of product search index (Admin only)."""
    # Permission verification
    if current_user.get("user_type") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied")

    service = SearchService(db)
    count = await service.index_all_products()
    await db.commit()
    return APIResponse(success=True, message=f"Indexed {count} products successfully")
