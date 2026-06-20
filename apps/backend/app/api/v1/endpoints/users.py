"""
User management endpoints — profile, addresses, preferences.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    APIResponse, AddressCreate, AddressResponse, PaginatedResponse,
    PaginationMeta, UserProfileUpdate, UserResponse,
)
from app.core.rbac.engine import get_current_user, require_permissions
from app.db.session import get_db
from app.models.user import User, UserAddress, UserProfile

router = APIRouter()


@router.get("/me", response_model=APIResponse[UserResponse])
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's profile."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return APIResponse(success=True, data=UserResponse.model_validate(user))


@router.get("/me/stream-token", response_model=APIResponse)
async def get_stream_token(
    current_user: dict = Depends(get_current_user),
):
    """Generate a token for GetStream Video SDK."""
    import os
    import time
    import jwt
    
    api_key = os.getenv("STREAM_API_KEY", "sbjiwala_stream_key")
    api_secret = os.getenv("STREAM_API_SECRET", "sbjiwala_stream_secret")
    
    user_id = str(current_user["user_id"])
    now = int(time.time())
    payload = {
        "user_id": user_id,
        "iat": now,
        "exp": now + (24 * 3600),  # Valid for 24 hours
    }
    
    token = jwt.encode(payload, api_secret, algorithm="HS256")
    
    return APIResponse(
        success=True,
        data={
            "token": token,
            "apiKey": api_key,
            "userId": user_id
        }
    )


@router.patch("/me", response_model=APIResponse[UserResponse])
@router.put("/me", response_model=APIResponse[UserResponse])
async def update_profile(
    body: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.first_name is not None:
        user.first_name = body.first_name
    if body.last_name is not None:
        user.last_name = body.last_name

    # Update profile record
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalars().first()
    if profile:
        if body.display_name is not None:
            profile.display_name = body.display_name
        if body.gender is not None:
            profile.gender = body.gender
        if body.language is not None:
            profile.language = body.language
        if body.bio is not None:
            profile.bio = body.bio

    await db.flush()
    return APIResponse(success=True, message="Profile updated", data=UserResponse.model_validate(user))


@router.get("/me/addresses", response_model=APIResponse[List[AddressResponse]])
async def get_addresses(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all saved addresses for the current user."""
    result = await db.execute(
        select(UserAddress)
        .where(UserAddress.user_id == current_user["user_id"], UserAddress.is_deleted == False)
        .order_by(UserAddress.is_default.desc(), UserAddress.created_at.desc())
    )
    addresses = result.scalars().all()
    return APIResponse(
        success=True,
        data=[AddressResponse.model_validate(a) for a in addresses],
    )


@router.post("/me/addresses", response_model=APIResponse[AddressResponse], status_code=201)
async def add_address(
    body: AddressCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new address."""
    if body.is_default:
        await db.execute(
            update(UserAddress)
            .where(UserAddress.user_id == current_user["user_id"])
            .values(is_default=False)
        )

    address = UserAddress(
        user_id=current_user["user_id"],
        **body.model_dump(),
    )
    db.add(address)
    await db.flush()

    return APIResponse(success=True, message="Address added", data=AddressResponse.model_validate(address))


@router.put("/me/addresses/{address_id}", response_model=APIResponse[AddressResponse])
async def update_address(
    address_id: UUID,
    body: AddressCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing address."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user["user_id"],
            UserAddress.is_deleted == False,
        )
    )
    address = result.scalars().first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    if body.is_default:
        await db.execute(
            update(UserAddress)
            .where(UserAddress.user_id == current_user["user_id"], UserAddress.id != address_id)
            .values(is_default=False)
        )

    for field, value in body.model_dump().items():
        setattr(address, field, value)

    await db.flush()
    return APIResponse(success=True, message="Address updated", data=AddressResponse.model_validate(address))


@router.delete("/me/addresses/{address_id}")
async def delete_address(
    address_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an address."""
    result = await db.execute(
        select(UserAddress).where(
            UserAddress.id == address_id,
            UserAddress.user_id == current_user["user_id"],
            UserAddress.is_deleted == False,
        )
    )
    address = result.scalars().first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    address.soft_delete(current_user["user_id"])
    await db.flush()
    return APIResponse(success=True, message="Address deleted")


# ===== Admin user management =====

@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    page: int = 1,
    page_size: int = 20,
    user_type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    from app.core.rbac.engine import rbac_engine
    has_perm = await rbac_engine.has_permission(current_user["user_id"], "users.read", db)
    if not has_perm:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    query = select(User).where(User.is_deleted == False)

    if user_type:
        query = query.where(User.user_type == user_type)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        query = query.where(
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%")) |
            (User.first_name.ilike(f"%{search}%")) |
            (User.last_name.ilike(f"%{search}%"))
        )

    # Count
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        success=True,
        data=[UserResponse.model_validate(u) for u in users],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )
