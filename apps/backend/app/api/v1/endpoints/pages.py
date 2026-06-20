"""
Public pages router to serve published CMS pages.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.db.session import get_db
from app.models.cms import CmsPage

router = APIRouter()


@router.get("/{slug}", response_model=APIResponse)
async def get_public_page(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details of a published CMS page by its slug."""
    res = await db.execute(select(CmsPage).where(CmsPage.slug == slug, CmsPage.is_published == True))
    page = res.scalars().first()
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
        
    data = {
        "slug": page.slug,
        "title": page.title,
        "content": page.content,
        "content_html": page.content_html,
        "meta_title": page.meta_title,
        "meta_description": page.meta_description,
    }
    return APIResponse(success=True, data=data)
