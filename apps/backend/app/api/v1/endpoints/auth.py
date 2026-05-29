"""
Authentication endpoints — register, login (password/OTP/social), refresh, logout, MFA, password reset.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    APIResponse, LoginRequest, MFASetupResponse, MFAVerifyRequest,
    OTPLoginRequest, OTPVerifyRequest, PasswordResetConfirm,
    PasswordResetRequest, RefreshTokenRequest, RegisterRequest,
    TokenResponse, UserResponse,
)
from app.core.config import settings
from app.core.rbac.engine import get_current_user
from app.core.security.jwt import (
    create_access_token, create_refresh_token, rotate_refresh_token,
    revoke_all_user_sessions, store_refresh_token, blacklist_token,
)
from app.core.security.mfa import setup_mfa, verify_totp, verify_backup_code
from app.core.security.otp import send_otp, verify_otp
from app.core.security.password import hash_password, verify_password, validate_password_strength
from app.db.session import get_db
from app.models.user import AuthProvider, User, UserProfile, UserRole, UserType, UserSession
from app.core.security.encryption import encrypt_string

logger = structlog.get_logger()
router = APIRouter()


async def _get_redis(request: Request) -> Redis:
    """Get Redis connection from app state."""
    redis = getattr(request.app.state, "redis", None)
    if not redis:
        from redis.asyncio import from_url
        redis = await from_url(settings.redis_url, decode_responses=False)
        request.app.state.redis = redis
    return redis


def _generate_referral_code() -> str:
    """Generate a unique 8-character referral code."""
    return secrets.token_urlsafe(6).upper()[:8]


@router.post("/register", response_model=APIResponse[UserResponse])
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new customer account."""
    # Validate at least email or phone
    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Email or phone number is required")

    # Check existing user
    conditions = []
    if body.email:
        conditions.append(User.email == body.email)
    if body.phone:
        conditions.append(User.phone == body.phone)

    result = await db.execute(
        select(User).where(or_(*conditions), User.is_deleted == False)
    )
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="User with this email or phone already exists")

    # Validate password if provided
    if body.password:
        issues = validate_password_strength(body.password)
        if issues:
            raise HTTPException(status_code=400, detail={"message": "Weak password", "issues": issues})

    # Create user
    user = User(
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password) if body.password else None,
        first_name=body.first_name,
        last_name=body.last_name,
        user_type=UserType.CUSTOMER,
        auth_provider=AuthProvider.LOCAL,
        referral_code=_generate_referral_code(),
    )

    # Handle referral
    if body.referral_code:
        referrer = await db.execute(
            select(User).where(User.referral_code == body.referral_code, User.is_deleted == False)
        )
        referrer_user = referrer.scalars().first()
        if referrer_user:
            user.referred_by = referrer_user.id

    db.add(user)
    await db.flush()

    # Create profile
    profile = UserProfile(user_id=user.id)
    db.add(profile)

    # Assign customer role
    from sqlalchemy import select as sa_select
    from app.models.user import Role
    role_result = await db.execute(sa_select(Role).where(Role.name == "customer"))
    customer_role = role_result.scalars().first()
    if customer_role:
        user_role = UserRole(user_id=user.id, role_id=customer_role.id)
        db.add(user_role)

    await db.flush()

    # Generate tokens
    redis = await _get_redis(request)
    access_token = create_access_token(user.id, user.user_type.value, body.device_id)
    refresh_token, token_hash = create_refresh_token(user.id, body.device_id)
    await store_refresh_token(redis, user.id, token_hash, body.device_id)

    # Create session
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)

    await logger.ainfo("User registered", user_id=str(user.id), email=user.email)

    return APIResponse(
        success=True,
        message="Registration successful",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    )


@router.post("/login", response_model=APIResponse[UserResponse])
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email/phone and password."""
    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")

    # Find user
    conditions = []
    if body.email:
        conditions.append(User.email == body.email)
    if body.phone:
        conditions.append(User.phone == body.phone)

    result = await db.execute(
        select(User).where(or_(*conditions), User.is_deleted == False)
    )
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account is temporarily locked. Please try again later.")

    # Check if account is active
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Verify password
    if not user.password_hash or not body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, user.password_hash):
        # Increment failed attempts
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            await logger.awarning("Account locked", user_id=str(user.id))
        await db.flush()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check MFA
    if user.mfa_enabled:
        # Return partial response — client must verify MFA
        mfa_token = create_access_token(
            user.id, user.user_type.value, body.device_id,
            extra_claims={"mfa_required": True, "mfa_pending": True}
        )
        return APIResponse(
            success=True,
            message="MFA verification required",
            data=None,
            meta={"mfa_required": True, "mfa_token": mfa_token},
        )

    # Reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None

    # Generate tokens
    redis = await _get_redis(request)
    access_token = create_access_token(user.id, user.user_type.value, body.device_id)
    refresh_token, token_hash = create_refresh_token(user.id, body.device_id)
    await store_refresh_token(redis, user.id, token_hash, body.device_id)

    # Create session
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)

    await logger.ainfo("User logged in", user_id=str(user.id))

    return APIResponse(
        success=True,
        message="Login successful",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    )


@router.post("/otp/send", response_model=APIResponse)
async def send_login_otp(
    body: OTPLoginRequest,
    request: Request,
):
    """Send OTP for passwordless login."""
    if body.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number login is temporarily disabled. Please use Email OTP login."
        )

    identifier = body.phone or body.email
    if not identifier:
        raise HTTPException(status_code=400, detail="Phone or email is required")

    redis = await _get_redis(request)
    result = await send_otp(redis, identifier, body.purpose)

    if not result["success"]:
        raise HTTPException(status_code=429, detail=result["message"])

    return APIResponse(success=True, message=result["message"], meta=result)


@router.post("/otp/verify", response_model=APIResponse[UserResponse])
async def verify_login_otp(
    body: OTPVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and login/register user."""
    if body.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number login is temporarily disabled. Please use Email OTP login."
        )

    identifier = body.phone or body.email
    if not identifier:
        raise HTTPException(status_code=400, detail="Phone or email is required")

    redis = await _get_redis(request)
    result = await verify_otp(redis, identifier, body.otp, body.purpose)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Find or create user
    if body.phone:
        user_result = await db.execute(select(User).where(User.phone == body.phone, User.is_deleted == False))
    else:
        user_result = await db.execute(select(User).where(User.email == body.email, User.is_deleted == False))

    user = user_result.scalars().first()

    if not user:
        # Auto-register on first OTP login
        user = User(
            email=body.email,
            phone=body.phone,
            first_name="",
            last_name="",
            user_type=UserType.CUSTOMER,
            auth_provider=AuthProvider.LOCAL,
            is_phone_verified=True if body.phone else False,
            is_email_verified=True if body.email else False,
            referral_code=_generate_referral_code(),
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(user_id=user.id)
        db.add(profile)

        from app.models.user import Role
        role_result = await db.execute(select(Role).where(Role.name == "customer"))
        customer_role = role_result.scalars().first()
        if customer_role:
            user_role = UserRole(user_id=user.id, role_id=customer_role.id)
            db.add(user_role)
        await db.flush()

    # Update verification status
    if body.phone:
        user.is_phone_verified = True
    if body.email:
        user.is_email_verified = True

    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None

    # Generate tokens
    access_token = create_access_token(user.id, user.user_type.value, body.device_id)
    refresh_token, token_hash = create_refresh_token(user.id, body.device_id)
    await store_refresh_token(redis, user.id, token_hash, body.device_id)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)

    return APIResponse(
        success=True,
        message="OTP verified successfully",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        },
    )


@router.post("/refresh", response_model=APIResponse)
async def refresh_tokens(
    body: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token rotation."""
    from app.core.security.jwt import decode_token
    import jwt as pyjwt

    try:
        payload = decode_token(body.refresh_token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = UUID(payload["sub"])
    device_id = payload.get("device_id")

    # Get user to build permissions
    result = await db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    redis = await _get_redis(request)

    try:
        tokens = await rotate_refresh_token(
            redis, body.refresh_token, user_id, user.user_type.value, device_id
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return APIResponse(
        success=True,
        message="Tokens refreshed",
        meta=tokens,
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Logout — blacklist the current access token."""
    redis = await _get_redis(request)
    jti = current_user.get("jti", "")
    if jti:
        await blacklist_token(redis, jti, settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    return APIResponse(success=True, message="Logged out successfully")


@router.post("/logout/all")
async def logout_all_devices(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Logout from all devices — revoke all refresh tokens."""
    redis = await _get_redis(request)
    count = await revoke_all_user_sessions(redis, current_user["user_id"])
    return APIResponse(success=True, message=f"Logged out from {count} devices")


@router.post("/mfa/setup", response_model=APIResponse[MFASetupResponse])
async def setup_user_mfa(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set up MFA (TOTP) for the current user."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    mfa_data = setup_mfa(user.email or user.phone or str(user.id))

    # Store encrypted secret temporarily (not enabled until verified)
    user.mfa_secret = encrypt_string(mfa_data["secret"])

    import json
    user.mfa_backup_codes = encrypt_string(json.dumps(mfa_data["backup_codes"]))

    await db.flush()

    return APIResponse(
        success=True,
        message="Scan the QR code with your authenticator app, then verify with a code",
        data=MFASetupResponse(
            secret=mfa_data["secret"],
            qr_code=mfa_data["qr_code"],
            backup_codes=mfa_data["backup_codes"],
        ),
    )


@router.post("/mfa/verify", response_model=APIResponse)
async def verify_mfa_code(
    body: MFAVerifyRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify MFA code (during setup or login)."""
    from app.core.security.encryption import decrypt_string

    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not set up")

    secret = decrypt_string(user.mfa_secret)

    if verify_totp(secret, body.code):
        if not user.mfa_enabled:
            user.mfa_enabled = True
            await db.flush()
            return APIResponse(success=True, message="MFA enabled successfully")

        # Login MFA verification — issue full tokens
        redis = await _get_redis(request)
        access_token = create_access_token(user.id, user.user_type.value)
        refresh_token, token_hash = create_refresh_token(user.id)
        await store_refresh_token(redis, user.id, token_hash)

        return APIResponse(
            success=True,
            message="MFA verified",
            meta={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
            },
        )

    # Try backup code
    if user.mfa_backup_codes:
        import json
        backup_codes = json.loads(decrypt_string(user.mfa_backup_codes))
        is_valid, remaining = verify_backup_code(body.code, backup_codes)
        if is_valid:
            user.mfa_backup_codes = encrypt_string(json.dumps(remaining))
            await db.flush()

            redis = await _get_redis(request)
            access_token = create_access_token(user.id, user.user_type.value)
            refresh_token, token_hash = create_refresh_token(user.id)
            await store_refresh_token(redis, user.id, token_hash)

            return APIResponse(
                success=True,
                message=f"Backup code used. {len(remaining)} codes remaining.",
                meta={
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                },
            )

    raise HTTPException(status_code=401, detail="Invalid MFA code")


@router.post("/mfa/disable", response_model=APIResponse)
async def disable_mfa(
    body: MFAVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable MFA (requires current TOTP code)."""
    from app.core.security.encryption import decrypt_string

    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not enabled")

    secret = decrypt_string(user.mfa_secret)
    if not verify_totp(secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_backup_codes = None
    await db.flush()

    return APIResponse(success=True, message="MFA disabled")


@router.get("/google")
async def google_login_redirect():
    """Redirect to Google OAuth2 login."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    import urllib.parse
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.get("/google/callback", response_model=APIResponse)
async def google_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth2 callback."""
    import httpx

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

        tokens = token_response.json()
        id_token = tokens.get("id_token", "")

        # Get user info
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")

        google_user = userinfo_response.json()

    email = google_user.get("email", "")
    google_id = google_user.get("sub", "")

    # Find existing user
    result = await db.execute(
        select(User).where(
            or_(
                User.email == email,
                (User.auth_provider == AuthProvider.GOOGLE) & (User.auth_provider_id == google_id),
            ),
            User.is_deleted == False,
        )
    )
    user = result.scalars().first()

    if not user:
        # Create new user
        user = User(
            email=email,
            first_name=google_user.get("given_name", ""),
            last_name=google_user.get("family_name", ""),
            user_type=UserType.CUSTOMER,
            auth_provider=AuthProvider.GOOGLE,
            auth_provider_id=google_id,
            is_email_verified=google_user.get("email_verified", False),
            is_verified=True,
            avatar_url=google_user.get("picture"),
            referral_code=_generate_referral_code(),
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(user_id=user.id)
        db.add(profile)

        from app.models.user import Role
        role_result = await db.execute(select(Role).where(Role.name == "customer"))
        customer_role = role_result.scalars().first()
        if customer_role:
            user_role = UserRole(user_id=user.id, role_id=customer_role.id)
            db.add(user_role)
        await db.flush()

    user.last_login_at = datetime.now(timezone.utc)

    # Generate tokens
    redis = await _get_redis(request)
    access_token = create_access_token(user.id, user.user_type.value)
    refresh_token, token_hash = create_refresh_token(user.id)
    await store_refresh_token(redis, user.id, token_hash)

    return APIResponse(
        success=True,
        message="Google login successful",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        },
    )


@router.get("/facebook")
async def facebook_login_redirect():
    """Redirect to Facebook OAuth2 login."""
    params = {
        "client_id": settings.FACEBOOK_CLIENT_ID,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "response_type": "code",
        "scope": "email,public_profile",
    }
    import urllib.parse
    url = f"https://www.facebook.com/v19.0/dialog/oauth?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.get("/facebook/callback", response_model=APIResponse)
async def facebook_callback(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Facebook OAuth2 callback."""
    import httpx

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            data={
                "code": code,
                "client_id": settings.FACEBOOK_CLIENT_ID,
                "client_secret": settings.FACEBOOK_CLIENT_SECRET,
                "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code with Facebook")

        tokens = token_response.json()
        access_token_fb = tokens.get("access_token")

        # Get user info
        userinfo_response = await client.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,first_name,last_name,email,picture",
                "access_token": access_token_fb,
            },
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info from Facebook")

        fb_user = userinfo_response.json()

    email = fb_user.get("email", "")
    fb_id = fb_user.get("id", "")

    # If Facebook did not return an email, use placeholder
    if not email:
        email = f"{fb_id}@facebook.sabjiwala.in"

    # Find existing user
    result = await db.execute(
        select(User).where(
            or_(
                User.email == email,
                (User.auth_provider == AuthProvider.FACEBOOK) & (User.auth_provider_id == fb_id),
            ),
            User.is_deleted == False,
        )
    )
    user = result.scalars().first()

    if not user:
        # Create new user
        pic_data = fb_user.get("picture", {}).get("data", {})
        avatar_url = pic_data.get("url") if not pic_data.get("is_silhouette") else None

        user = User(
            email=email,
            first_name=fb_user.get("first_name", ""),
            last_name=fb_user.get("last_name", ""),
            user_type=UserType.CUSTOMER,
            auth_provider=AuthProvider.FACEBOOK,
            auth_provider_id=fb_id,
            is_email_verified=True,
            is_verified=True,
            avatar_url=avatar_url,
            referral_code=_generate_referral_code(),
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(user_id=user.id)
        db.add(profile)

        from app.models.user import Role
        role_result = await db.execute(select(Role).where(Role.name == "customer"))
        customer_role = role_result.scalars().first()
        if customer_role:
            user_role = UserRole(user_id=user.id, role_id=customer_role.id)
            db.add(user_role)
        await db.flush()

    user.last_login_at = datetime.now(timezone.utc)

    # Generate tokens
    redis = await _get_redis(request)
    access_token = create_access_token(user.id, user.user_type.value)
    refresh_token, token_hash = create_refresh_token(user.id)
    await store_refresh_token(redis, user.id, token_hash)

    return APIResponse(
        success=True,
        message="Facebook login successful",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        },
    )
