"""
OTP Service — generate and verify one-time passwords for phone/email login.
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from redis.asyncio import Redis

logger = structlog.get_logger()

OTP_PREFIX = "otp:"
OTP_RATE_PREFIX = "otp:rate:"
OTP_LENGTH = 6
OTP_EXPIRY_SECONDS = 300  # 5 minutes
OTP_MAX_ATTEMPTS = 5
OTP_RATE_LIMIT_SECONDS = 60  # Minimum 1 minute between OTP requests


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return "".join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])


async def send_otp(
    redis: Redis,
    identifier: str,
    purpose: str = "login",
    request = None,
    db = None,
) -> dict:
    """
    Generate and store an OTP for a given identifier (phone/email).

    Args:
        redis: Redis connection
        identifier: Phone number or email
        purpose: OTP purpose (login, register, reset_password, verify_email, verify_phone)
        request: FastAPI Request (optional)
        db: AsyncSession database connection (optional)

    Returns:
        dict with otp (only in debug mode), expires_at, message
    """
    from app.core.config import settings

    # Rate limit check
    rate_key = f"{OTP_RATE_PREFIX}{purpose}:{identifier}"
    rate_exists = await redis.exists(rate_key)
    if rate_exists:
        ttl = await redis.ttl(rate_key)
        return {
            "success": False,
            "message": f"Please wait {ttl} seconds before requesting a new OTP",
            "retry_after": ttl,
        }

    # Generate OTP
    otp = generate_otp()

    # Store in Redis
    otp_key = f"{OTP_PREFIX}{purpose}:{identifier}"
    otp_data = {
        "otp": otp,
        "attempts": "0",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.hset(otp_key, mapping=otp_data)  # type: ignore
    await redis.expire(otp_key, OTP_EXPIRY_SECONDS)

    # Set rate limit
    await redis.setex(rate_key, OTP_RATE_LIMIT_SECONDS, "1")

    # Send OTP via SMS or Email based on identifier
    if "@" in identifier:
        await send_otp_via_email(identifier, otp, request=request, db=db)
    else:
        await send_otp_via_sms(identifier, otp)

    result = {
        "success": True,
        "message": f"OTP sent to {_mask_identifier(identifier)}",
        "expires_in": OTP_EXPIRY_SECONDS,
    }

    await logger.ainfo("OTP generated and sent", identifier=_mask_identifier(identifier), purpose=purpose)

    return result


async def _find_user_by_any_identifier(db, identifier: str):
    """
    Look up a user in the database by email, username, or phone number.
    Handles various phone number formatting styles.
    """
    from app.models.user import User
    from sqlalchemy import select, or_

    clean_id = identifier.strip()
    phone_candidates = [clean_id]
    digits = "".join(filter(str.isdigit, clean_id))
    if digits:
        phone_candidates.append(digits)
        if len(digits) == 10:
            phone_candidates.append(f"+91{digits}")
            phone_candidates.append(f"91{digits}")
        elif digits.startswith("91") and len(digits) == 12:
            phone_candidates.append(digits[2:])
            phone_candidates.append(f"+{digits}")
            phone_candidates.append(f"+91{digits[2:]}")

    query = select(User).where(
        or_(
            User.email.ilike(clean_id),
            User.username.ilike(clean_id),
            User.phone.in_(phone_candidates)
        ),
        User.is_deleted == False
    )
    result = await db.execute(query)
    return result.scalars().first()


async def send_otp_via_sms(phone: str, otp: str) -> None:
    """Send OTP to the user's phone using configured MSG91 credentials."""
    import httpx
    from app.core.config import settings

    if not settings.MSG91_AUTH_KEY:
        logger.warning("MSG91 Auth Key not configured, SMS OTP logged but not sent", phone=phone, otp=otp)
        return

    clean_phone = phone.strip()
    if clean_phone.startswith("+"):
        clean_phone = clean_phone[1:]
    elif len(clean_phone) == 10 and clean_phone.isdigit():
        clean_phone = f"91{clean_phone}"

    payload = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "mobile": clean_phone,
        "otp": otp
    }
    headers = {
        "authkey": settings.MSG91_AUTH_KEY,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://control.msg91.com/api/v5/otp",
                json=payload,
                headers=headers,
                timeout=10
            )
        res_data = response.json() if "application/json" in response.headers.get("content-type", "") else {"text": response.text}
        
        if response.status_code in [200, 201] and res_data.get("type") != "error":
            await logger.ainfo("MSG91 OTP SMS sent successfully", to=phone)
        else:
            await logger.aerror("Failed to send MSG91 OTP SMS", error=str(res_data), to=phone)
    except Exception as e:
        await logger.aerror("Exception occurred while sending MSG91 OTP SMS", error=str(e), to=phone)


async def send_otp_via_email(
    email: str,
    otp: str,
    request = None,
    db = None,
) -> None:
    """Send OTP to the user's email using configurable SMTP settings."""
    import aiosmtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from app.core.config import settings

    if not settings.SMTP_HOST or not settings.SMTP_PORT:
        logger.warning("SMTP server not configured, email OTP logged but not sent", email=email, otp=otp)
        return

    # Construct email message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your Sbjiwala login OTP"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = email

    # HTML body
    from app.services.notification_service import get_frontend_url
    origin = request.headers.get("origin") if request else None
    host = request.headers.get("host") if request else None
    user_agent = request.headers.get("user-agent") if request else None
    frontend_url = get_frontend_url(host=host, origin=origin, user_agent=user_agent)
    logo_horizontal_url = f"{frontend_url}/logo_horizontal.png"
    logo_vertical_url = f"{frontend_url}/logo_vertical.png"

    # Fetch social settings
    social_facebook = ""
    social_instagram = ""
    social_twitter = ""
    social_linkedin = ""
    social_youtube = ""
    
    if db:
        try:
            from app.models.system import SystemSetting
            from sqlalchemy import select
            settings_result = await db.execute(
                select(SystemSetting).where(SystemSetting.key.in_([
                    "social_facebook", "social_instagram", "social_twitter", "social_linkedin", "social_youtube"
                ]))
            )
            social_map = {s.key: s.value for s in settings_result.scalars().all() if s.value}
            social_facebook = social_map.get("social_facebook", "")
            social_instagram = social_map.get("social_instagram", "")
            social_twitter = social_map.get("social_twitter", "")
            social_linkedin = social_map.get("social_linkedin", "")
            social_youtube = social_map.get("social_youtube", "")
        except Exception as e:
            logger.error("Failed to load social settings for OTP email", error=str(e))

    social_links_html = ""
    has_social = any([social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube])
    if has_social:
        social_links_html = """
        <div style="margin-bottom: 16px; text-align: center;">
            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Follow us</p>
        """
        if social_facebook:
            social_links_html += f"""
            <a href="{social_facebook}" style="margin: 0 8px; text-decoration: none; display: inline-block;">
                <img src="https://img.icons8.com/material-outlined/24/059669/facebook-new.png" width="20" height="20" alt="Facebook" style="display: block; border: 0;" />
            </a>
            """
        if social_instagram:
            social_links_html += f"""
            <a href="{social_instagram}" style="margin: 0 8px; text-decoration: none; display: inline-block;">
                <img src="https://img.icons8.com/material-outlined/24/059669/instagram-new.png" width="20" height="20" alt="Instagram" style="display: block; border: 0;" />
            </a>
            """
        if social_twitter:
            social_links_html += f"""
            <a href="{social_twitter}" style="margin: 0 8px; text-decoration: none; display: inline-block;">
                <img src="https://img.icons8.com/material-outlined/24/059669/twitter.png" width="20" height="20" alt="Twitter" style="display: block; border: 0;" />
            </a>
            """
        if social_linkedin:
            social_links_html += f"""
            <a href="{social_linkedin}" style="margin: 0 8px; text-decoration: none; display: inline-block;">
                <img src="https://img.icons8.com/material-outlined/24/059669/linkedin.png" width="20" height="20" alt="LinkedIn" style="display: block; border: 0;" />
            </a>
            """
        if social_youtube:
            social_links_html += f"""
            <a href="{social_youtube}" style="margin: 0 8px; text-decoration: none; display: inline-block;">
                <img src="https://img.icons8.com/material-outlined/24/059669/youtube-play.png" width="20" height="20" alt="YouTube" style="display: block; border: 0;" />
            </a>
            """
        social_links_html += "</div>"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 40px 20px; color: #1e293b;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0;">
            <tr>
                <td style="padding: 30px; text-align: center; background: #ffffff; border-bottom: 1px solid #f1f5f9;">
                    <img src="{logo_horizontal_url}" style="width: 95px; height: auto; display: block; margin: 0 auto;" alt="Sbjiwala" />
                </td>
            </tr>
            <tr>
                <td style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <img src="{logo_vertical_url}" style="width: 80px; height: auto; display: block; margin: 0 auto 16px auto;" alt="Sbjiwala" />
                        <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a; text-align: center;">Secure Login OTP</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">You have requested to log in. Please use the verification code below to securely access your account.</p>
                    </div>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
                        <span style="font-family: monospace; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #059669; display: inline-block; margin-left: 12px;">{otp}</span>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0 0 24px 0;">This code is valid for <strong>5 minutes</strong>. Please do not share it with anyone.</p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                            <td style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center;">
                                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">If you didn't request this code, you can safely ignore this email. Your account remains secure.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                    {social_links_html}
                    <p style="margin: 0; color: #94a3b8; font-size: 13px; font-weight: 500;">&copy; 2026 Sbjiwala Technologies. All rights reserved.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    # Attach plain text and HTML
    plain_text = f"Your Sbjiwala login OTP is: {otp}. Valid for 5 minutes."
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Determine correct TLS mode from port to avoid aiosmtplib incompatibility.
    # Port 465 → implicit TLS (use_tls=True, start_tls=False)
    # Port 587 → STARTTLS (use_tls=False, start_tls=True)
    # Port 25  → no TLS (both False)
    use_tls = settings.SMTP_USE_TLS
    start_tls = settings.SMTP_START_TLS
    port = settings.SMTP_PORT
    # Always enforce port-based protocol correctness — overrides any misconfigured settings
    if port == 465:
        use_tls = True
        start_tls = False
    elif port == 587:
        use_tls = False
        start_tls = True
    elif port == 25:
        use_tls = False
        start_tls = False
    elif use_tls and start_tls:
        # Unknown port but both True — pick one
        use_tls = True
        start_tls = False

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=10,
        )
        await logger.ainfo("SMTP OTP email sent successfully", to=email)
    except Exception as e:
        await logger.aerror("Failed to send SMTP OTP email", error=str(e), to=email)



async def verify_otp(
    redis: Redis,
    identifier: str,
    otp: str,
    purpose: str = "login",
) -> dict:
    """
    Verify an OTP for a given identifier.

    Returns:
        dict with success, message
    """
    otp_key = f"{OTP_PREFIX}{purpose}:{identifier}"
    otp_data = await redis.hgetall(otp_key)  # type: ignore

    if not otp_data:
        return {"success": False, "message": "OTP expired or not found"}

    # Decode bytes if needed
    stored_otp = otp_data.get(b"otp", otp_data.get("otp", ""))
    attempts = otp_data.get(b"attempts", otp_data.get("attempts", "0"))
    if isinstance(stored_otp, bytes):
        stored_otp = stored_otp.decode()
    if isinstance(attempts, bytes):
        attempts = attempts.decode()

    attempts = int(attempts) if attempts is not None else 0

    # Check max attempts
    if attempts >= OTP_MAX_ATTEMPTS:
        await redis.delete(otp_key)
        return {"success": False, "message": "Maximum verification attempts exceeded"}

    # Increment attempts
    await redis.hset(otp_key, "attempts", str(attempts + 1))  # type: ignore

    # Verify
    if otp.strip() == stored_otp:
        await redis.delete(otp_key)
        await logger.ainfo("OTP verified", identifier=_mask_identifier(identifier), purpose=purpose)
        return {"success": True, "message": "OTP verified successfully"}

    remaining = OTP_MAX_ATTEMPTS - attempts - 1
    return {
        "success": False,
        "message": f"Invalid OTP. {remaining} attempts remaining",
    }


def _mask_identifier(identifier: str) -> str:
    """Mask a phone/email for logging."""
    if "@" in identifier:
        local, domain = identifier.split("@", 1)
        return f"{local[:2]}***@{domain}"
    if len(identifier) > 4:
        return f"***{identifier[-4:]}"
    return "***"
