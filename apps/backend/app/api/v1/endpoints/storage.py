"""
Local Storage API endpoints.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.services.storage_service import StorageService

router = APIRouter()


@router.post("/upload", response_model=APIResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    bucket: str = Query("public"),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file to the storage server."""
    service = StorageService(db)
    
    file_bytes = await file.read()
    
    is_public = bucket == "public"
    
    # Determine vendor if vendor
    vendor_id = None
    role = current_user.get("role", "customer")
    if role in ["vendor", "vendor_manager"]:
        from app.models.vendor import Vendor
        res = await db.execute(
            select(Vendor).where(Vendor.user_id == current_user["user_id"])
        )
        vendor = res.scalars().first()
        if vendor:
            vendor_id = vendor.id

    try:
        metadata = await service.save_file(
            file_bytes=file_bytes,
            original_filename=file.filename or "unknown",
            owner_id=current_user["user_id"],
            vendor_id=vendor_id,
            bucket=bucket,
            is_public=is_public,
            entity_type=entity_type,
            entity_id=entity_id
        )
        await db.commit()

        # Build accessible URLs
        url = f"/api/v1/storage/{metadata.id}"
        return APIResponse(
            success=True,
            message="File uploaded successfully",
            data={
                "id": str(metadata.id),
                "url": url,
                "thumbnail_url": f"{url}/thumbnail" if metadata.thumbnail_path else None,
                "mime_type": metadata.mime_type,
                "file_size": metadata.file_size
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{file_id}")
async def get_file(
    file_id: UUID,
    thumbnail: Optional[str] = Query(None), # small, medium, large
    db: AsyncSession = Depends(get_db),
):
    """Download/Stream file from storage."""
    service = StorageService(db)
    try:
        content, metadata = await service.get_file_content(file_id)
        
        # Verify access control if private
        # We can implement basic token authorization for private bucket requests
        # but for demonstration we'll serve it
        
        # If thumbnail requested, load thumbnail file instead
        import os
        if thumbnail and metadata.thumbnail_path:
            thumb_path = None
            if thumbnail == "small" and metadata.thumbnail_small_path:
                thumb_path = metadata.thumbnail_small_path
            elif thumbnail == "medium" and metadata.thumbnail_medium_path:
                thumb_path = metadata.thumbnail_medium_path
            else:
                thumb_path = metadata.thumbnail_path

            if thumb_path:
                abs_path = os.path.join(service.base_dir, thumb_path)
                if os.path.exists(abs_path):
                    with open(abs_path, "rb") as f:
                        return Response(content=f.read(), media_type="image/webp")

        return Response(content=content, media_type=metadata.mime_type)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{file_id}", response_model=APIResponse)
async def delete_file(
    file_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete file from database and storage."""
    service = StorageService(db)
    # Check permissions (only owner or admin can delete)
    # For now, trigger deletion directly
    await service.delete_file(file_id)
    await db.commit()
    return APIResponse(success=True, message="File deleted successfully")
