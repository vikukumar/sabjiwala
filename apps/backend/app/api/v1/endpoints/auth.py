"""
Authentication endpoints — register, login (password/OTP/social), refresh, logout, MFA, password reset.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from redis.asyncio import Redis
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    APIResponse, LoginRequest, MFASetupResponse, MFAVerifyRequest,
    OTPLoginRequest, OTPVerifyRequest, PasswordResetConfirm,
    PasswordResetRequest, RefreshTokenRequest, RegisterRequest,
    TokenResponse, UserResponse,
    PasskeyRegisterOptionsRequest, PasskeyRegisterOptionsResponse,
    PasskeyRegisterVerifyRequest, PasskeyLoginOptionsRequest,
    PasskeyLoginOptionsResponse, PasskeyLoginVerifyRequest,
    MagicLinkRequest, PasswordResetVerifyRequest,
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
    """Register a new account (Customer, Vendor, Delivery Boy, or Admin)."""
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
    existing_user = result.scalars().first()
    if existing_user:
        from sqlalchemy import select as sa_select
        from app.models.user import Role
        role_name = body.role or "customer"
        if role_name == "delivery":
            role_name = "delivery_boy"

        role_result = await db.execute(sa_select(Role).where(Role.name == role_name))
        db_role = role_result.scalars().first()
        if db_role:
            ur_check = await db.execute(select(UserRole).where(UserRole.user_id == existing_user.id, UserRole.role_id == db_role.id))
            if ur_check.scalars().first():
                raise HTTPException(status_code=409, detail=f"User is already registered as a {role_name}")

            # Append the new role
            user_role = UserRole(user_id=existing_user.id, role_id=db_role.id)
            db.add(user_role)

            # Initialize profiles based on new role
            if role_name == "vendor":
                from app.models.vendor import Vendor, VendorWallet, VendorStatus, VendorStore, VendorDeliveryRule
                v_check = await db.execute(select(Vendor).where(Vendor.user_id == existing_user.id))
                vendor = v_check.scalars().first()
                if not vendor:
                    vendor = Vendor(
                        user_id=existing_user.id,
                        business_name=body.business_name or f"{existing_user.first_name} {existing_user.last_name}'s Store",
                        business_type=body.business_type or "individual",
                        description=body.description,
                        gst_number=body.gst_number,
                        pan_number=body.pan_number,
                        fssai_number=body.fssai_number,
                        slug=f"{existing_user.first_name.lower()}-{existing_user.last_name.lower()}-{secrets.token_hex(4)}",
                        status=VendorStatus.PENDING,
                        contact_email=existing_user.email,
                        contact_phone=existing_user.phone
                    )
                    db.add(vendor)
                    await db.flush()

                vs_check = await db.execute(select(VendorStore).where(VendorStore.vendor_id == vendor.id))
                if not vs_check.scalars().first():
                    store = VendorStore(vendor_id=vendor.id, store_name=vendor.business_name)
                    db.add(store)

                vw_check = await db.execute(select(VendorWallet).where(VendorWallet.vendor_id == vendor.id))
                if not vw_check.scalars().first():
                    db.add(VendorWallet(vendor_id=vendor.id))

                vdr_check = await db.execute(select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor.id))
                if not vdr_check.scalars().first():
                    db.add(VendorDeliveryRule(vendor_id=vendor.id))

            elif role_name == "delivery_boy":
                from app.models.delivery import DeliveryBoy, DeliveryBoyStatus, AvailabilityStatus, DeliveryWallet
                from app.models.payment import Wallet, WalletType
                db_check = await db.execute(select(DeliveryBoy).where(DeliveryBoy.user_id == existing_user.id))
                delivery_boy = db_check.scalars().first()
                if not delivery_boy:
                    delivery_boy = DeliveryBoy(
                        user_id=existing_user.id,
                        status=DeliveryBoyStatus.ACTIVE,
                        availability=AvailabilityStatus.OFFLINE,
                        vehicle_type=body.vehicle_type or "motorcycle",
                        vehicle_number=body.vehicle_number or "",
                        license_number=body.license_number or ""
                    )
                    db.add(delivery_boy)
                    await db.flush()

                w_check = await db.execute(select(Wallet).where(Wallet.user_id == existing_user.id, Wallet.wallet_type == WalletType.DELIVERY))
                if not w_check.scalars().first():
                    db.add(Wallet(user_id=existing_user.id, wallet_type=WalletType.DELIVERY))

                dw_check = await db.execute(select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == delivery_boy.id))
                if not dw_check.scalars().first():
                    db.add(DeliveryWallet(delivery_boy_id=delivery_boy.id))

            await db.flush()

            # Send registration OTP to existing user
            verification_identifier = existing_user.email if (existing_user.email and existing_user.phone) else (existing_user.email or existing_user.phone)
            if not verification_identifier:
                raise HTTPException(status_code=400, detail="User email or phone is required")

            redis = await _get_redis(request)
            otp_res = await send_otp(redis, verification_identifier, purpose="register")
            if not otp_res["success"]:
                raise HTTPException(status_code=400, detail=otp_res["message"])

            meta_data = {
                "requires_otp_verification": True,
                "verification_identifier": verification_identifier,
            }
            if "otp" in otp_res:
                meta_data["otp"] = otp_res["otp"]

            await db.commit()
            await logger.ainfo("Role added to existing user", user_id=str(existing_user.id), role=role_name)

            return APIResponse(
                success=True,
                message=f"Added {role_name} role. Please verify using the OTP sent to your {'email' if '@' in verification_identifier else 'mobile number'}.",
                data=UserResponse.model_validate(existing_user),
                meta=meta_data
            )
        else:
            raise HTTPException(status_code=409, detail="User with this email or phone already exists")

    # Validate password if provided
    if body.password:
        issues = validate_password_strength(body.password)
        if issues:
            raise HTTPException(status_code=400, detail={"message": "Weak password", "issues": issues})

    # Determine user_type based on role
    role_to_type = {
        "customer": UserType.CUSTOMER,
        "vendor": UserType.VENDOR,
        "delivery_boy": UserType.DELIVERY_BOY,
        "admin": UserType.ADMIN,
    }
    user_type = role_to_type.get(body.role, UserType.CUSTOMER) if body.role is not None else UserType.CUSTOMER

    # Create user - set as unverified and inactive until OTP is verified
    user = User(
        email=body.email,
        phone=body.phone,
        username=body.username,
        password_hash=hash_password(body.password) if body.password else None,
        first_name=body.first_name,
        last_name=body.last_name,
        user_type=user_type,
        auth_provider=AuthProvider.LOCAL,
        is_verified=False,
        is_active=False,
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

    # Assign role
    from sqlalchemy import select as sa_select
    from app.models.user import Role
    role_name = body.role or "customer"
    role_result = await db.execute(sa_select(Role).where(Role.name == role_name))
    db_role = role_result.scalars().first()
    if not db_role:
        # fallback
        role_result = await db.execute(sa_select(Role).where(Role.name == "customer"))
        db_role = role_result.scalars().first()
    if db_role:
        user_role = UserRole(user_id=user.id, role_id=db_role.id)
        db.add(user_role)

    # Specific profile and wallet creation based on type
    if user_type == UserType.VENDOR:
        from app.models.vendor import Vendor, VendorWallet, VendorStatus, VendorStore
        vendor = Vendor(
            user_id=user.id,
            business_name=body.business_name or f"{user.first_name} {user.last_name}'s Store",
            business_type=body.business_type or "individual",
            description=body.description,
            gst_number=body.gst_number,
            pan_number=body.pan_number,
            fssai_number=body.fssai_number,
            slug=f"{user.first_name.lower()}-{user.last_name.lower()}-{secrets.token_hex(4)}",
            status=VendorStatus.PENDING,
            contact_email=user.email,
            contact_phone=user.phone
        )
        db.add(vendor)
        await db.flush()

        store = VendorStore(
            vendor_id=vendor.id,
            store_name=vendor.business_name,
        )
        db.add(store)

        vendor_wallet = VendorWallet(vendor_id=vendor.id)
        db.add(vendor_wallet)
    elif user_type == UserType.DELIVERY_BOY:
        from app.models.delivery import DeliveryBoy, DeliveryBoyStatus, AvailabilityStatus, DeliveryWallet
        from app.models.payment import Wallet, WalletType
        delivery_boy = DeliveryBoy(
            user_id=user.id,
            status=DeliveryBoyStatus.ACTIVE,
            availability=AvailabilityStatus.OFFLINE,
            vehicle_type=body.vehicle_type,
            vehicle_number=body.vehicle_number,
            license_number=body.license_number
        )
        db.add(delivery_boy)
        await db.flush()

        delivery_wallet = Wallet(user_id=user.id, wallet_type=WalletType.DELIVERY)
        db.add(delivery_wallet)

        delivery_boy_wallet = DeliveryWallet(delivery_boy_id=delivery_boy.id)
        db.add(delivery_boy_wallet)
    elif user_type == UserType.CUSTOMER:
        from app.models.payment import Wallet, WalletType
        customer_wallet = Wallet(user_id=user.id, wallet_type=WalletType.CUSTOMER)
        db.add(customer_wallet)

    await db.flush()

    # Send registration OTP (prioritize email if both provided, else whichever is available)
    verification_identifier = body.email if (body.email and body.phone) else (body.email or body.phone)
    if not verification_identifier:
        raise HTTPException(status_code=400, detail="Email or phone number is required")

    redis = await _get_redis(request)
    otp_res = await send_otp(redis, verification_identifier, purpose="register")
    if not otp_res["success"]:
        raise HTTPException(status_code=400, detail=otp_res["message"])

    await logger.ainfo("User registered", user_id=str(user.id), email=user.email, role=body.role)

    meta_data = {
        "requires_otp_verification": True,
        "verification_identifier": verification_identifier,
    }
    if "otp" in otp_res:
        meta_data["otp"] = otp_res["otp"]

    await db.commit()

    return APIResponse(
        success=True,
        message=f"Registration successful. Please verify the OTP sent to your {'email' if '@' in verification_identifier else 'mobile number'}.",
        data=UserResponse.model_validate(user),
        meta=meta_data
    )


async def verify_and_resolve_user_role(db: AsyncSession, user_id: UUID, requested_role_name: str) -> str:
    """
    Verifies that the user has the requested role (or a role that encompasses it).
    Returns the resolved role name if verified, else raises HTTPException.
    """
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import selectinload
    from app.models.user import Role, UserRole
    
    if requested_role_name == "delivery":
        requested_role_name = "delivery_boy"
        
    role_res = await db.execute(sa_select(Role).where(Role.name == requested_role_name))
    db_role = role_res.scalars().first()
    if not db_role:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    # Get all direct roles for this user
    ur_res = await db.execute(
        sa_select(UserRole)
        .options(selectinload(UserRole.role))
        .where(UserRole.user_id == user_id, UserRole.is_deleted == False)
    )
    user_roles = [ur.role for ur in ur_res.scalars().all() if ur.role]
    user_role_names = {r.name for r in user_roles}
    
    # 1. Exact match check
    if requested_role_name in user_role_names:
        return requested_role_name
        
    # 2. Super admin encompasses all roles
    if "super_admin" in user_role_names:
        return requested_role_name
        
    # 3. Admin encompasses admin, support_agent, and customer
    if "admin" in user_role_names and requested_role_name in ["admin", "support_agent", "customer"]:
        return requested_role_name
        
    # 4. Check hierarchical relationship via parent role IDs recursively/iteratively
    current_role = db_role
    visited = set()
    while current_role and current_role.id not in visited:
        visited.add(current_role.id)
        if current_role.name in user_role_names:
            return requested_role_name
        if current_role.parent_role_id:
            parent_res = await db.execute(sa_select(Role).where(Role.id == current_role.parent_role_id))
            current_role = parent_res.scalars().first()
        else:
            break
            
    raise HTTPException(status_code=400, detail=f"User does not have the {requested_role_name} role")


def _decrypt_payload_if_needed(request: Request, body) -> Optional[dict]:
    """Decrypt the body using E2EE RSA/AES if E2EE fields are present."""
    if not (hasattr(body, "encrypted_key") and body.encrypted_key and body.encrypted_payload and body.iv and body.tag):
        return None
        
    private_key = getattr(request.app.state, "rsa_private_key", None)
    if not private_key:
        raise HTTPException(status_code=400, detail="E2EE key not configured on server")
        
    import base64
    import json
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        # 1. Decrypt the AES session key using server's RSA private key (OAEP with SHA-256)
        encrypted_key = base64.b64decode(body.encrypted_key)
        aes_key = private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # 2. Decrypt the actual payload using the decrypted AES session key (AES-256-GCM)
        iv = base64.b64decode(body.iv)
        tag = base64.b64decode(body.tag)
        ciphertext = base64.b64decode(body.encrypted_payload)
        
        aesgcm = AESGCM(aes_key)
        decrypted_bytes = aesgcm.decrypt(iv, ciphertext + tag, None)
        
        return json.loads(decrypted_bytes.decode("utf-8"))
    except Exception as e:
        logger.error("E2EE Payload decryption failed", error=str(e))
        raise HTTPException(status_code=400, detail="E2EE payload decryption failed")


@router.get("/e2ee/key", response_model=APIResponse)
async def get_e2ee_public_key(request: Request, response: Response):
    """Retrieve the server's public key for E2EE payload encryption."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    public_key = getattr(request.app.state, "rsa_public_key", None)
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="E2EE public key not generated or server starting up"
        )
    
    from cryptography.hazmat.primitives import serialization
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("utf-8")
    
    return APIResponse(success=True, data={"public_key": pem})


from fastapi.security import OAuth2PasswordRequestForm

@router.post("/token", include_in_schema=True)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible token login, required for Swagger UI."""
    body = LoginRequest(
        identifier=form_data.username,
        password=form_data.password,
    )
    response = await login(body=body, request=request, db=db)
    
    if response.success and response.meta:
        return {
            "access_token": response.meta["access_token"],
            "token_type": response.meta["token_type"]
        }
    raise HTTPException(status_code=400, detail="Login failed")

@router.post("/login", response_model=APIResponse[UserResponse])
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login with email/phone/username and password."""
    # Check for E2EE payload
    decrypted = _decrypt_payload_if_needed(request, body)
    if decrypted:
        body.identifier = decrypted.get("identifier")
        body.email = decrypted.get("email")
        body.phone = decrypted.get("phone")
        body.password = decrypted.get("password")
        body.device_id = decrypted.get("device_id")
        body.role = decrypted.get("role")

    identifier = body.identifier or body.email or body.phone
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier (email, phone, or username) is required")

    # Find user using helper
    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, identifier)

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

    # Resolve active login role
    active_role = user.user_type.value
    if body.role:
        active_role = await verify_and_resolve_user_role(db, user.id, body.role)

    # Check MFA
    if user.mfa_enabled:
        # Return partial response — client must verify MFA
        mfa_token = create_access_token(
            user.id, active_role, body.device_id,
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
    access_token = create_access_token(user.id, active_role, body.device_id)
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
    await db.flush()

    await logger.ainfo("User logged in", user_id=str(user.id))

    user_res = UserResponse.model_validate(user)
    user_res.active_role = active_role

    return APIResponse(
        success=True,
        message="Login successful",
        data=user_res,
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
    db: AsyncSession = Depends(get_db),
):
    """Send OTP for passwordless login or verification."""
    identifier = body.identifier or body.phone or body.email
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier (phone, email, or username) is required")

    redis = await _get_redis(request)

    # For login / reset password, check user existence first.
    # For register, the user has already been created in register endpoint (unverified, is_active=False).
    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, identifier)

    if body.purpose in ["login", "reset_password"]:
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prioritized routing: Email then SMS
        if user.email and user.phone:
            target_identifier = user.email
        else:
            target_identifier = user.email or user.phone
    elif body.purpose == "register":
        # If user doesn't exist, they need to sign up first
        if not user:
            raise HTTPException(status_code=404, detail="User not found. Please sign up first.")
        # Prioritize email for registration if both exist
        if user.email and user.phone:
            target_identifier = user.email
        else:
            target_identifier = user.email or user.phone
    else:
        target_identifier = identifier

    # For login / register, do not send OTP to phone numbers, instruct to use password
    if target_identifier and "@" not in target_identifier and body.purpose in ["login", "register"]:
        raise HTTPException(
            status_code=400,
            detail="Please use your password with your mobile number to log in."
        )

    result = await send_otp(redis, target_identifier, body.purpose)

    if not result["success"]:
        raise HTTPException(status_code=429, detail=result["message"])

    return APIResponse(success=True, message=result["message"], meta=result)


@router.post("/otp/verify", response_model=APIResponse[UserResponse])
async def verify_login_otp(
    body: OTPVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and log in / activate user."""
    # Check for E2EE payload
    decrypted = _decrypt_payload_if_needed(request, body)
    if decrypted:
        body.identifier = decrypted.get("identifier")
        body.email = decrypted.get("email")
        body.phone = decrypted.get("phone")
        body.otp = decrypted.get("otp")
        body.purpose = decrypted.get("purpose", "login")
        body.device_id = decrypted.get("device_id")
        body.role = decrypted.get("role")

    identifier = body.identifier or body.phone or body.email
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier (phone, email, or username) is required")

    redis = await _get_redis(request)

    # Find user
    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Determine what target identifier was used to send the OTP
    if user.email and user.phone:
        target_identifier = user.email
    else:
        target_identifier = user.email or user.phone

    if not target_identifier:
        raise HTTPException(status_code=400, detail="User email or phone is missing")

    if not body.otp:
        raise HTTPException(status_code=400, detail="OTP is required")

    result = await verify_otp(redis, target_identifier, body.otp, body.purpose)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Activate user if they are inactive or unverified
    if not user.is_active or not user.is_verified:
        user.is_active = True
        user.is_verified = True
        if "@" in target_identifier:
            user.is_email_verified = True
        else:
            user.is_phone_verified = True
        await db.flush()

    # Reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None
    await db.flush()

    # Resolve active login role
    active_role = user.user_type.value
    if body.role:
        active_role = await verify_and_resolve_user_role(db, user.id, body.role)

    # Generate tokens
    access_token = create_access_token(user.id, active_role, body.device_id)
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
    await db.flush()

    user_res = UserResponse.model_validate(user)
    user_res.active_role = active_role

    return APIResponse(
        success=True,
        message="OTP verified successfully",
        data=user_res,
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
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
async def google_login_redirect(state: Optional[str] = None):
    """Redirect to Google OAuth2 login."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    if state:
        params["state"] = state
    import urllib.parse
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    request: Request,
    state: Optional[str] = None,
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

    if state:
        # Validate state URL to prevent Open Redirect vulnerability
        is_allowed = False
        state_lower = state.lower()
        if state_lower.startswith(("in.sbjiwala.customer://", "in.sbjiwala.vendor://", "in.sbjiwala.delivery://", "in.sbjiwala.agent://", "in.sbjiwala.admin://")):
            is_allowed = True
        elif "localhost" in state_lower or "127.0.0.1" in state_lower:
            is_allowed = True
        elif settings.APP_URL and settings.APP_URL.lower().split("://")[-1] in state_lower:
            is_allowed = True
        elif "sbjiwala.qzz.io" in state_lower:
            is_allowed = True

        if is_allowed:
            from fastapi.responses import RedirectResponse
            separator = "&" if "?" in state else "?"
            redirect_url = f"{state}{separator}access_token={access_token}&refresh_token={refresh_token}"
            return RedirectResponse(url=redirect_url)

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
async def facebook_login_redirect(state: Optional[str] = None):
    """Redirect to Facebook OAuth2 login."""
    params = {
        "client_id": settings.FACEBOOK_CLIENT_ID,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "response_type": "code",
        "scope": "email,public_profile",
    }
    if state:
        params["state"] = state
    import urllib.parse
    url = f"https://www.facebook.com/v19.0/dialog/oauth?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.get("/facebook/callback")
async def facebook_callback(
    code: str,
    request: Request,
    state: Optional[str] = None,
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
        email = f"{fb_id}@facebook.sbjiwala.qzz.io"

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

    if state:
        # Validate state URL to prevent Open Redirect vulnerability
        is_allowed = False
        state_lower = state.lower()
        if state_lower.startswith(("in.sbjiwala.customer://", "in.sbjiwala.vendor://", "in.sbjiwala.delivery://", "in.sbjiwala.agent://", "in.sbjiwala.admin://")):
            is_allowed = True
        elif "localhost" in state_lower or "127.0.0.1" in state_lower:
            is_allowed = True
        elif settings.APP_URL and settings.APP_URL.lower().split("://")[-1] in state_lower:
            is_allowed = True
        elif "sbjiwala.qzz.io" in state_lower:
            is_allowed = True

        if is_allowed:
            from fastapi.responses import RedirectResponse
            separator = "&" if "?" in state else "?"
            redirect_url = f"{state}{separator}access_token={access_token}&refresh_token={refresh_token}"
            return RedirectResponse(url=redirect_url)

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


# ===== Passkey (WebAuthn) Endpoints =====

@router.post("/passkey/register/options", response_model=APIResponse[PasskeyRegisterOptionsResponse])
async def passkey_register_options(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate options for WebAuthn passkey registration."""
    result = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    challenge = secrets.token_urlsafe(32)
    
    redis = await _get_redis(request)
    await redis.setex(f"passkey:register_challenge:{user.id}", 300, challenge)

    return APIResponse(
        success=True,
        message="Registration options generated",
        data=PasskeyRegisterOptionsResponse(
            challenge=challenge,
            rp={
                "name": "Sbjiwala",
                "id": request.url.hostname or "localhost"
            },
            user={
                "id": str(user.id),
                "name": user.email or user.phone or user.username or str(user.id),
                "displayName": f"{user.first_name} {user.last_name}".strip() or "User"
            }
        )
    )


@router.post("/passkey/register/verify", response_model=APIResponse)
async def passkey_register_verify(
    body: PasskeyRegisterVerifyRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify and save WebAuthn passkey credentials."""
    redis = await _get_redis(request)
    stored_challenge = await redis.get(f"passkey:register_challenge:{current_user['user_id']}")
    if not stored_challenge:
        raise HTTPException(status_code=400, detail="Challenge expired or not found")
    
    await redis.delete(f"passkey:register_challenge:{current_user['user_id']}")

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == current_user["user_id"]))
    profile = result.scalars().first()
    if not profile:
        profile = UserProfile(user_id=current_user["user_id"])
        db.add(profile)
        await db.flush()

    preferences = profile.preferences
    if preferences is None:
        preferences = {}
        profile.preferences = preferences
    
    passkeys = preferences.get("passkeys", [])
    
    # Check if credential already exists
    for pk in passkeys:
        if pk["credential_id"] == body.credential_id:
            raise HTTPException(status_code=400, detail="Passkey credential already registered")

    passkeys.append({
        "credential_id": body.credential_id,
        "public_key_pem": body.public_key_pem,
        "device_name": body.device_name,
        "registered_at": datetime.now(timezone.utc).isoformat()
    })

    from sqlalchemy.orm.attributes import flag_modified
    preferences["passkeys"] = passkeys
    profile.preferences = preferences
    flag_modified(profile, "preferences")
    
    # Also mark user as having verification done if register purpose was used
    result_user = await db.execute(select(User).where(User.id == current_user["user_id"]))
    user = result_user.scalars().first()
    if user and not user.is_verified:
        user.is_verified = True
        await db.flush()

    await db.flush()

    return APIResponse(
        success=True,
        message="Passkey registered successfully"
    )


@router.post("/passkey/login/options", response_model=APIResponse[PasskeyLoginOptionsResponse])
async def passkey_login_options(
    body: PasskeyLoginOptionsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate options for WebAuthn passkey login."""
    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalars().first()
    
    passkeys = []
    if profile and profile.preferences:
        passkeys = profile.preferences.get("passkeys", [])

    if not passkeys:
        raise HTTPException(status_code=400, detail="No passkeys registered for this user")

    challenge = secrets.token_urlsafe(32)
    
    redis = await _get_redis(request)
    await redis.setex(f"passkey:login_challenge:{body.identifier}", 300, challenge)

    allow_credentials = [pk["credential_id"] for pk in passkeys]

    return APIResponse(
        success=True,
        message="Login options generated",
        data=PasskeyLoginOptionsResponse(
            challenge=challenge,
            allow_credentials=allow_credentials
        )
    )


@router.post("/passkey/login/verify", response_model=APIResponse[UserResponse])
async def passkey_login_verify(
    body: PasskeyLoginVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify signature and complete WebAuthn passkey login."""
    redis = await _get_redis(request)
    stored_challenge = await redis.get(f"passkey:login_challenge:{body.identifier}")
    if not stored_challenge:
        raise HTTPException(status_code=400, detail="Challenge expired or not found")
    
    if isinstance(stored_challenge, bytes):
        stored_challenge = stored_challenge.decode()

    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalars().first()
    
    passkey = None
    if profile and profile.preferences:
        passkeys = profile.preferences.get("passkeys", [])
        for pk in passkeys:
            if pk["credential_id"] == body.credential_id:
                passkey = pk
                break

    if not passkey:
        raise HTTPException(status_code=400, detail="Invalid credential ID")

    # Verify signature
    import base64
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, rsa, padding
    from cryptography.hazmat.primitives.serialization import load_pem_public_key

    try:
        def urlsafe_b64decode(s: str) -> bytes:
            s = s.replace("-", "+").replace("_", "/")
            padding_len = (4 - len(s) % 4) % 4
            s += "=" * padding_len
            return base64.b64decode(s)

        auth_data = urlsafe_b64decode(body.authenticator_data_b64)
        client_data_json = urlsafe_b64decode(body.client_data_json_b64)
        signature = urlsafe_b64decode(body.signature_b64)

        import json
        client_data = json.loads(client_data_json.decode("utf-8"))
        client_challenge = client_data.get("challenge")
        
        # Normalize comparison
        if client_challenge.rstrip("=") != stored_challenge.rstrip("="):
            raise HTTPException(status_code=400, detail="Challenge mismatch")

        client_data_hash = hashlib.sha256(client_data_json).digest()
        verify_data = auth_data + client_data_hash

        pub_key = load_pem_public_key(passkey["public_key_pem"].encode("utf-8"))

        if isinstance(pub_key, ec.EllipticCurvePublicKey):
            pub_key.verify(
                signature,
                verify_data,
                ec.ECDSA(hashes.SHA256())
            )
        elif isinstance(pub_key, rsa.RSAPublicKey):
            pub_key.verify(
                signature,
                verify_data,
                padding.PKCS1v15(),
                hashes.SHA256()
            )
        else:
            raise Exception("Unsupported key type")

    except Exception as e:
        await logger.aerror("Passkey signature verification failed", error=str(e))
        raise HTTPException(status_code=401, detail="Passkey verification failed")

    await redis.delete(f"passkey:login_challenge:{body.identifier}")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None
    await db.flush()

    # Resolve active login role
    active_role = user.user_type.value
    if body.role:
        active_role = await verify_and_resolve_user_role(db, user.id, body.role)

    access_token = create_access_token(user.id, active_role, body.device_id)
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
    await db.flush()

    return APIResponse(
        success=True,
        message="Passkey login successful",
        data=UserResponse.model_validate(user),
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    )


# ===== Magic Link Endpoints =====

@router.post("/magic-link/request", response_model=APIResponse)
async def magic_link_request(
    body: MagicLinkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generate and send a passwordless magic login link."""
    from app.core.security.otp import _find_user_by_any_identifier, send_otp_via_sms
    
    user = await _find_user_by_any_identifier(db, body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = secrets.token_urlsafe(32)
    
    import json
    redis = await _get_redis(request)
    redis_data = json.dumps({"user_id": str(user.id), "role": body.role})
    await redis.setex(f"magic_link:{token}", 600, redis_data)

    # Formulate login URL
    origin = request.headers.get("origin") or "http://localhost:3000"
    magic_url = f"{origin}/login?magic_token={token}"

    sent_via = ""
    if user.email:
        sent_via = "email"
        if settings.SMTP_HOST:
            import aiosmtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Your Sbjiwala Magic Login Link"
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            msg["To"] = user.email
            
            html_body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #0f172a;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                  <div style="background-color: #10b981; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">Sbjiwala</h1>
                  </div>
                  <div style="padding: 32px; text-align: center;">
                    <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #1e293b;">Magic Login Link</h2>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Click the button below to instantly log in to your Sbjiwala account. This link is valid for 10 minutes.</p>
                    <a href="{magic_url}" style="background-color: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; display: inline-block;">
                      Log In Instantly
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If the button doesn't work, copy and paste this URL into your browser:<br/><a href="{magic_url}" style="color: #10b981;">{magic_url}</a></p>
                  </div>
                </div>
              </body>
            </html>
            """
            msg.attach(MIMEText(f"Click here to login: {magic_url}", "plain"))
            msg.attach(MIMEText(html_body, "html"))
            
            # Enforce port-based TLS protocol (port 465→SSL, 587→STARTTLS, 25→no TLS)
            _smtp_port = settings.SMTP_PORT
            if _smtp_port == 465:
                use_tls, start_tls = True, False
            elif _smtp_port == 587:
                use_tls, start_tls = False, True
            elif _smtp_port == 25:
                use_tls, start_tls = False, False
            else:
                use_tls = settings.SMTP_USE_TLS
                start_tls = settings.SMTP_START_TLS
                if use_tls and start_tls:
                    use_tls, start_tls = True, False

            try:
                await aiosmtplib.send(
                    msg,
                    hostname=settings.SMTP_HOST,
                    port=settings.SMTP_PORT,
                    username=settings.SMTP_USER or None,
                    password=settings.SMTP_PASSWORD or None,
                    use_tls=use_tls,
                    start_tls=start_tls,
                    timeout=10
                )
            except Exception as e:
                await logger.aerror("Failed to send SMTP Magic Link", error=str(e), to=user.email)
                raise HTTPException(status_code=500, detail="Failed to send magic link email")
    elif user.phone:
        sent_via = "phone"
        sms_msg = f"Use this link to log in to your Sbjiwala account: {magic_url}"
        await send_otp_via_sms(user.phone, sms_msg)
    else:
        raise HTTPException(status_code=400, detail="User does not have a registered email or phone")

    return APIResponse(
        success=True,
        message=f"Magic link sent successfully via {sent_via}."
    )


@router.get("/magic-link/verify", response_model=APIResponse[UserResponse])
async def magic_link_verify(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify magic link token and complete login."""
    redis = await _get_redis(request)
    stored_str = await redis.get(f"magic_link:{token}")
    if not stored_str:
        raise HTTPException(status_code=400, detail="Invalid or expired magic link token")

    if isinstance(stored_str, bytes):
        stored_str = stored_str.decode()

    import json
    try:
        data = json.loads(stored_str)
        user_id_str = data["user_id"]
        role = data.get("role")
    except Exception:
        user_id_str = stored_str
        role = None

    result = await db.execute(select(User).where(User.id == UUID(user_id_str), User.is_deleted == False))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await redis.delete(f"magic_link:{token}")

    if not user.is_active or not user.is_verified:
        user.is_active = True
        user.is_verified = True
        await db.flush()

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None
    await db.flush()

    # Resolve active login role
    active_role = user.user_type.value
    if role:
        active_role = await verify_and_resolve_user_role(db, user.id, role)

    access_token = create_access_token(user.id, active_role)
    refresh_token, token_hash = create_refresh_token(user.id)
    await store_refresh_token(redis, user.id, token_hash)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.flush()

    user_res = UserResponse.model_validate(user)
    user_res.active_role = active_role

    return APIResponse(
        success=True,
        message="Login successful",
        data=user_res,
        meta={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    )


# ===== Password Reset Endpoints =====

@router.post("/password/reset/request", response_model=APIResponse)
async def password_reset_request(
    body: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset OTP."""
    identifier = body.identifier or body.email or body.phone
    if not identifier:
        raise HTTPException(status_code=400, detail="Email, phone, or username is required")

    from app.core.security.otp import _find_user_by_any_identifier
    user = await _find_user_by_any_identifier(db, identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email and user.phone:
        target_identifier = user.email
    else:
        target_identifier = user.email or user.phone

    redis = await _get_redis(request)
    result = await send_otp(redis, target_identifier, purpose="reset_password")
    if not result["success"]:
        raise HTTPException(status_code=429, detail=result["message"])

    return APIResponse(
        success=True,
        message=result["message"],
        meta=result
    )


@router.post("/password/reset/verify", response_model=APIResponse)
async def password_reset_verify(
    body: PasswordResetVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify password reset OTP and return reset token."""
    from app.core.security.otp import _find_user_by_any_identifier, verify_otp
    user = await _find_user_by_any_identifier(db, body.identifier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email and user.phone:
        target_identifier = user.email
    else:
        target_identifier = user.email or user.phone

    redis = await _get_redis(request)
    result = await verify_otp(redis, target_identifier, body.otp, purpose="reset_password")
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    reset_token = secrets.token_urlsafe(32)
    await redis.setex(f"password_reset_token:{reset_token}", 900, str(user.id))

    return APIResponse(
        success=True,
        message="OTP verified. Use the token to reset your password.",
        meta={"reset_token": reset_token}
    )


@router.post("/password/reset/confirm", response_model=APIResponse)
async def password_reset_confirm(
    body: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Confirm password reset using verification token."""
    redis = await _get_redis(request)
    user_id_str = await redis.get(f"password_reset_token:{body.token}")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if isinstance(user_id_str, bytes):
        user_id_str = user_id_str.decode()

    result = await db.execute(select(User).where(User.id == UUID(user_id_str), User.is_deleted == False))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    issues = validate_password_strength(body.new_password)
    if issues:
        raise HTTPException(status_code=400, detail={"message": "Weak password", "issues": issues})

    user.password_hash = hash_password(body.new_password)
    await revoke_all_user_sessions(redis, user.id)
    await redis.delete(f"password_reset_token:{body.token}")

    await db.flush()

    return APIResponse(
        success=True,
        message="Password reset successfully"
    )
