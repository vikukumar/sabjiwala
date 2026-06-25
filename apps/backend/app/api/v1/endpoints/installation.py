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
from app.core.config import settings
from app.db.session import get_db
from app.models.system import InstallationState, SystemSetting

router = APIRouter()


async def seed_system_settings(db: AsyncSession):
    defaults = [
        {"key": "app_name", "value": "Sbjiwala", "value_type": "string", "group": "appearance", "description": "Brand name of the application", "is_public": True},
        {"key": "app_logo_url", "value": "/logo_horizontal.png", "value_type": "string", "group": "appearance", "description": "URL of the application logo", "is_public": True},
        {"key": "app_logo_vertical_url", "value": "/logo_vertical.png", "value_type": "string", "group": "appearance", "description": "URL of the vertical application logo", "is_public": True},
        {"key": "app_icon_url", "value": "/icon.png", "value_type": "string", "group": "appearance", "description": "URL of the square application icon", "is_public": True},
        {"key": "app_primary_color", "value": "#059669", "value_type": "string", "group": "appearance", "description": "Primary brand color hex code", "is_public": True},
        {"key": "app_secondary_color", "value": "#10b981", "value_type": "string", "group": "appearance", "description": "Secondary brand color hex code", "is_public": True},
        {"key": "app_dark_mode", "value": "true", "value_type": "boolean", "group": "appearance", "description": "Enable dark mode by default", "is_public": True},
        {"key": "seo_title", "value": "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak", "value_type": "string", "group": "seo", "description": "Global SEO meta title", "is_public": True},
        {"key": "seo_description", "value": "Read Sbjiwala's user data policy. Learn about precise GPS coordinate encryption, secure tokenized checkouts, and your personal data rights.", "value_type": "string", "group": "seo", "description": "Global SEO meta description", "is_public": True},
        {"key": "seo_keywords", "value": "vegetables, fruits, organic, quick commerce, delivery", "value_type": "string", "group": "seo", "description": "Global SEO keywords separated by commas", "is_public": True},
        {"key": "policy_privacy", "value": "At Sbjiwala, we prioritize the protection of your personal information. This Privacy Policy details how we collect, process, and secure your geolocation details, registration credentials, and purchase history. By using our applications, you consent to the practices described below.", "value_type": "string", "group": "policy", "description": "Privacy Policy HTML content", "is_public": True},
        {"key": "policy_terms", "value": "By accessing or placing orders through the Sbjiwala applications, you agree to comply with our purchasing guidelines. Orders are routed to the nearest vendor to ensure fresh 10-minute transit times. Conflicting vendor carts are not allowed.", "value_type": "string", "group": "policy", "description": "Terms and Conditions HTML content", "is_public": True},
        {"key": "policy_refund", "value": "Refunds are processed automatically for cancelled or failed orders directly to the user's wallet. Wallet balances can be used on future checkouts but are non-transferable to bank accounts.", "value_type": "string", "group": "policy", "description": "Refund and Cancellation Policy HTML content", "is_public": True},
        {"key": "about_us", "value": "Sbjiwala is a direct-to-home hyper-local quick commerce platform delivering fresh farm vegetables and fruits straight from local farms to your home in 10 minutes.", "value_type": "string", "group": "policy", "description": "About Us content", "is_public": True},
        {"key": "how_it_works", "value": "Our system detects your precise coordinates, displays catalog stock from the nearest vendor, dispatches the order to a nearby delivery boy, and delivers fresh in 10 minutes.", "value_type": "string", "group": "policy", "description": "How it works description", "is_public": True},
        {"key": "vapid_public_key", "value": settings.VAPID_PUBLIC_KEY or "", "value_type": "string", "group": "notification", "description": "VAPID Public Key for Web Push", "is_public": True},
        # Social Media Links
        {"key": "social_facebook", "value": "", "value_type": "string", "group": "appearance", "description": "Facebook Profile URL", "is_public": True},
        {"key": "social_instagram", "value": "", "value_type": "string", "group": "appearance", "description": "Instagram Profile URL", "is_public": True},
        {"key": "social_twitter", "value": "", "value_type": "string", "group": "appearance", "description": "Twitter Profile URL", "is_public": True},
        {"key": "social_linkedin", "value": "", "value_type": "string", "group": "appearance", "description": "LinkedIn Profile URL", "is_public": True},
        {"key": "social_youtube", "value": "", "value_type": "string", "group": "appearance", "description": "YouTube Channel URL", "is_public": True},
        # SMTP Settings
        {"key": "smtp_host", "value": "smtp.gmail.com", "value_type": "string", "group": "notification", "description": "SMTP Hostname", "is_public": False},
        {"key": "smtp_port", "value": "587", "value_type": "integer", "group": "notification", "description": "SMTP Port", "is_public": False},
        {"key": "smtp_user", "value": "", "value_type": "string", "group": "notification", "description": "SMTP Username", "is_public": False},
        {"key": "smtp_password", "value": "", "value_type": "string", "group": "notification", "description": "SMTP Password", "is_public": False},
        {"key": "smtp_from_name", "value": "Sabjiwala", "value_type": "string", "group": "notification", "description": "SMTP From Name", "is_public": True},
        {"key": "smtp_from_email", "value": "noreply@sbjiwala.qzz.io", "value_type": "string", "group": "notification", "description": "SMTP From Email Address", "is_public": True},
        {"key": "smtp_use_tls", "value": "false", "value_type": "boolean", "group": "notification", "description": "Enable TLS for SMTP", "is_public": False},
        {"key": "smtp_start_tls", "value": "true", "value_type": "boolean", "group": "notification", "description": "Enable StartTLS for SMTP", "is_public": False},
        # SMS Gateways
        {"key": "sms_provider", "value": "android_gateway", "value_type": "string", "group": "notification", "description": "SMS provider mode: android_gateway, sms_server, or msg91", "is_public": False},
        {"key": "sms_gateway_url", "value": "", "value_type": "string", "group": "notification", "description": "SMS gateway REST endpoint url", "is_public": False},
        {"key": "sms_gateway_key", "value": "", "value_type": "string", "group": "notification", "description": "SMS gateway key or bearer authorization token", "is_public": False},
        {"key": "sms_sender_id", "value": "SABJWL", "value_type": "string", "group": "notification", "description": "Default sender ID or channel name", "is_public": False},
        # Social Logins (Google, Facebook, Apple)
        {"key": "google_client_id", "value": "", "value_type": "string", "group": "security", "description": "Google Client ID for OAuth", "is_public": True},
        {"key": "google_client_secret", "value": "", "value_type": "string", "group": "security", "description": "Google Client Secret for OAuth", "is_public": False},
        {"key": "facebook_client_id", "value": "", "value_type": "string", "group": "security", "description": "Facebook App ID for OAuth", "is_public": True},
        {"key": "facebook_client_secret", "value": "", "value_type": "string", "group": "security", "description": "Facebook App Secret for OAuth", "is_public": False},
        {"key": "apple_client_id", "value": "", "value_type": "string", "group": "security", "description": "Apple Services Client ID for OAuth", "is_public": True},
        {"key": "apple_client_secret", "value": "", "value_type": "string", "group": "security", "description": "Apple Services Client Secret for OAuth", "is_public": False},
        {"key": "app_url", "value": "http://localhost:3000", "value_type": "string", "group": "general", "description": "Public URL of customer app to build dynamic oauth redirect links", "is_public": True},
        # Invoice Setup
        {"key": "invoice_template_html", "value": (
            "<!DOCTYPE html>\n"
            "<html>\n"
            "<head>\n"
            "    <meta charset=\"utf-8\">\n"
            "    <title>Invoice {{ order_number }}</title>\n"
            "    <style>\n"
            "        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }\n"
            "        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 16px; line-height: 24px; color: #555; }\n"
            "        .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }\n"
            "        .invoice-box table td { padding: 8px; vertical-align: top; }\n"
            "        .invoice-box table tr td:nth-child(2) { text-align: right; }\n"
            "        .invoice-box table tr.top table td { padding-bottom: 20px; }\n"
            "        .invoice-box table tr.top table td.title { font-size: 45px; line-height: 45px; color: #059669; font-weight: bold; }\n"
            "        .invoice-box table tr.information table td { padding-bottom: 40px; }\n"
            "        .invoice-box table tr.heading td { background: #059669; color: #fff; font-weight: bold; padding: 10px; }\n"
            "        .invoice-box table tr.details td { padding-bottom: 20px; }\n"
            "        .invoice-box table tr.item td { border-bottom: 1px solid #eee; }\n"
            "        .invoice-box table tr.item.last td { border-bottom: none; }\n"
            "        .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #059669; font-weight: bold; font-size: 18px; color: #059669; }\n"
            "        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }\n"
            "    </style>\n"
            "</head>\n"
            "<body>\n"
            "    <div class=\"invoice-box\">\n"
            "        <table>\n"
            "            <tr class=\"top\">\n"
            "                <td colspan=\"2\">\n"
            "                    <table>\n"
            "                        <tr>\n"
            "                            <td class=\"title\">\n"
            "                                {{ company_name }}\n"
            "                            </td>\n"
            "                            <td>\n"
            "                                Invoice #: {{ order_number }}<br>\n"
            "                                Date: {{ created_at }}<br>\n"
            "                                Status: {{ status }}\n"
            "                            </td>\n"
            "                        </tr>\n"
            "                    </table>\n"
            "                </td>\n"
            "            </tr>\n"
            "            <tr class=\"information\">\n"
            "                <td colspan=\"2\">\n"
            "                    <table>\n"
            "                        <tr>\n"
            "                            <td>\n"
            "                                <strong>Billed By:</strong><br>\n"
            "                                {{ vendor_name }}<br>\n"
            "                                {{ vendor_address }}<br>\n"
            "                                GSTIN: {{ vendor_gst }}\n"
            "                            </td>\n"
            "                            <td>\n"
            "                                <strong>Billed To:</strong><br>\n"
            "                                {{ customer_name }}<br>\n"
            "                                {{ customer_phone }}<br>\n"
            "                                {{ delivery_address }}\n"
            "                            </td>\n"
            "                        </tr>\n"
            "                    </table>\n"
            "                </td>\n"
            "            </tr>\n"
            "            <tr class=\"heading\">\n"
            "                <td>Item</td>\n"
            "                <td>Price</td>\n"
            "            </tr>\n"
            "            {% for item in items %}\n"
            "            <tr class=\"item\">\n"
            "                <td>{{ item.name }} (x{{ item.quantity }} {{ item.unit }})</td>\n"
            "                <td>₹{{ item.total_price }}</td>\n"
            "            </tr>\n"
            "            {% endfor %}\n"
            "            <tr class=\"total\">\n"
            "                <td></td>\n"
            "                <td>Total: ₹{{ total_amount }}</td>\n"
            "            </tr>\n"
            "        </table>\n"
            "        <div class=\"footer\">\n"
            "            Thank you for buying fresh from Sabjiwala! Keep supporting your local farmers.\n"
            "        </div>\n"
            "    </div>\n"
            "</body>\n"
            "</html>\n"
        ), "value_type": "string", "group": "appearance", "description": "HTML Jinja2 template layout of invoices", "is_public": True},
        {"key": "invoice_branding_json", "value": "", "value_json": {"company_name": "Sabjiwala", "company_address": "Main Wholesale Mandi, Jaipur, Rajasthan", "company_phone": "+91 99999 88888", "gstin": "08ABCDE1234F1Z1"}, "value_type": "json", "group": "appearance", "description": "Global business metadata attributes for invoices", "is_public": True},

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

@router.post("/reset-system", response_model=APIResponse)
async def reset_system(
    db: AsyncSession = Depends(get_db),
):
    """
    WARNING: This will completely clear the database and reset the system.
    Only to be used by super admin or during development.
    """
    import asyncio
    from app.db.session import engine
    from app.db.base import Base
    import app.models
    
    # Drop all tables and recreate them
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    return APIResponse(
        success=True,
        message="System has been completely reset. The database is now empty. Please re-run the installation wizard."
    )

