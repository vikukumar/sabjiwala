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
        from sqlalchemy import func
        
        # Check if there is already a super admin in the database
        count_res = await db.execute(select(func.count(User.id)).where(User.user_type == UserType.SUPER_ADMIN))
        super_admin_count = count_res.scalar() or 0
        if super_admin_count > 0:
            raise HTTPException(status_code=403, detail="Super Admin account has already been configured")
            
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

        # Ensure default roles and permissions are seeded first
        from app.core.rbac.seed import seed_default_roles_and_permissions
        await seed_default_roles_and_permissions(db)
        await db.flush()

        # Assign both super_admin and admin roles so the user satisfies the admin portal checks
        from app.models.user import Role, UserRole
        for role_name in ["super_admin", "admin"]:
            role_res = await db.execute(select(Role).where(Role.name == role_name))
            role = role_res.scalars().first()
            if role:
                # Avoid duplicate insertion (even if soft-deleted)
                ur_check = await db.execute(
                    select(UserRole).where(
                        UserRole.user_id == admin.id,
                        UserRole.role_id == role.id
                    )
                )
                existing_ur = ur_check.scalars().first()
                if existing_ur:
                    if existing_ur.is_deleted:
                        existing_ur.is_deleted = False
                        existing_ur.deleted_at = None
                        existing_ur.deleted_by = None
                else:
                    db.add(UserRole(user_id=admin.id, role_id=role.id))


    state.is_completed = True
    state.completed_at = datetime.now(timezone.utc)
    state.data = body.data

    await db.commit()
    return APIResponse(success=True, message=f"Step '{body.step}' completed successfully")
