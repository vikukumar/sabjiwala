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
from app.models.system import InstallationState, SystemSetting

router = APIRouter()


async def seed_system_settings(db: AsyncSession):
    defaults = [
        {"key": "app_name", "value": "Sbjiwala", "value_type": "string", "group": "appearance", "description": "Brand name of the application", "is_public": True},
        {"key": "app_logo_url", "value": "/logo_horizontal.png", "value_type": "string", "group": "appearance", "description": "URL of the application logo", "is_public": True},
        {"key": "app_primary_color", "value": "#059669", "value_type": "string", "group": "appearance", "description": "Primary brand color hex code", "is_public": True},
        {"key": "seo_title", "value": "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak", "value_type": "string", "group": "seo", "description": "Global SEO meta title", "is_public": True},
        {"key": "seo_description", "value": "Read Sbjiwala's user data policy. Learn about precise GPS coordinate encryption, secure tokenized checkouts, and your personal data rights.", "value_type": "string", "group": "seo", "description": "Global SEO meta description", "is_public": True},
        {"key": "seo_keywords", "value": "vegetables, fruits, organic, blinkit, zepto, quick commerce, delivery", "value_type": "string", "group": "seo", "description": "Global SEO keywords separated by commas", "is_public": True},
        {"key": "policy_privacy", "value": "At Sbjiwala, we prioritize the protection of your personal information. This Privacy Policy details how we collect, process, and secure your geolocation details, registration credentials, and purchase history. By using our applications, you consent to the practices described below.", "value_type": "string", "group": "policy", "description": "Privacy Policy HTML content", "is_public": True},
        {"key": "policy_terms", "value": "By accessing or placing orders through the Sbjiwala applications, you agree to comply with our purchasing guidelines. Orders are routed to the nearest vendor to ensure fresh 10-minute transit times. Conflicting vendor carts are not allowed.", "value_type": "string", "group": "policy", "description": "Terms and Conditions HTML content", "is_public": True},
        {"key": "policy_refund", "value": "Refunds are processed automatically for cancelled or failed orders directly to the user's wallet. Wallet balances can be used on future checkouts but are non-transferable to bank accounts.", "value_type": "string", "group": "policy", "description": "Refund and Cancellation Policy HTML content", "is_public": True},
        {"key": "about_us", "value": "Sbjiwala is a direct-to-home hyper-local quick commerce platform delivering fresh farm vegetables and fruits straight from local farms to your home in 10 minutes.", "value_type": "string", "group": "policy", "description": "About Us content", "is_public": True},
        {"key": "how_it_works", "value": "Our system detects your precise coordinates, displays catalog stock from the nearest vendor, dispatches the order to a nearby delivery boy, and delivers fresh in 10 minutes.", "value_type": "string", "group": "policy", "description": "How it works description", "is_public": True},
    ]
    for d in defaults:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == d["key"]))
        setting = res.scalars().first()
        if not setting:
            db.add(SystemSetting(**d))
    await db.flush()


@router.get("/status", response_model=APIResponse)
async def get_installation_status(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve setup wizard current step status."""
    await seed_system_settings(db)
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


@router.get("/public-settings", response_model=APIResponse)
async def get_public_settings(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve public branding, policy, and SEO config settings."""
    await seed_system_settings(db)
    res = await db.execute(
        select(SystemSetting).where(SystemSetting.is_public == True)
    )
    settings = res.scalars().all()
    
    data = {s.key: s.value_json if s.value_json else s.value for s in settings}
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
