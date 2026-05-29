"""
Setup and Installation Wizard API endpoints.
"""
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse, InstallationStep
from app.db.session import get_db
from app.models.system import InstallationState

router = APIRouter()


@router.get("/status", response_model=APIResponse)
async def get_installation_status(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve setup wizard current step status."""
    res = await db.execute(select(InstallationState))
    steps = res.scalars().all()
    
    # If no steps exist, initialize
    if not steps:
        all_steps = ["database", "admin_account", "platform_config", "branding", "notification", "payment", "complete"]
        steps = []
        for step in all_steps:
            item = InstallationState(step=step, is_completed=False)
            db.add(item)
            steps.append(item)
        await db.commit()

    data = {s.step: {"is_completed": s.is_completed, "completed_at": s.completed_at.isoformat() if s.completed_at else None} for s in steps}
    return APIResponse(success=True, data=data)


@router.post("/step", response_model=APIResponse)
async def complete_installation_step(
    body: InstallationStep,
    db: AsyncSession = Depends(get_db),
):
    """Mark an installation setup step as completed."""
    # Find step
    res = await db.execute(select(InstallationState).where(InstallationState.step == body.step))
    state = res.scalars().first()
    
    if not state:
        state = InstallationState(step=body.step)
        db.add(state)

    # Perform action-specific setup
    if body.step == "admin_account":
        # Create Super Admin account
        from app.models.user import User, UserProfile, UserType, AuthProvider
        from app.core.security.password import hash_password
        
        email = body.data.get("email")
        password = body.data.get("password")
        first_name = body.data.get("first_name", "Super")
        last_name = body.data.get("last_name", "Admin")

        if not email or not password:
            raise HTTPException(status_code=400, detail="email and password are required")

        # Verify admin doesn't exist
        exist_res = await db.execute(select(User).where(User.email == email))
        if exist_res.scalars().first():
            raise HTTPException(status_code=400, detail="User with this email already exists")

        admin = User(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            user_type=UserType.SUPER_ADMIN,
            auth_provider=AuthProvider.LOCAL,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
        )
        db.add(admin)
        await db.flush()

        profile = UserProfile(user_id=admin.id)
        db.add(profile)

        # Assign role
        from app.models.user import Role, UserRole
        role_res = await db.execute(select(Role).where(Role.name == "super_admin"))
        role = role_res.scalars().first()
        if role:
            db.add(UserRole(user_id=admin.id, role_id=role.id))

    state.is_completed = True
    state.completed_at = datetime.now(timezone.utc)
    state.data = body.data

    await db.commit()
    return APIResponse(success=True, message=f"Step '{body.step}' completed successfully")
