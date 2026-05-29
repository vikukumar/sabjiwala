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
) -> dict:
    """
    Generate and store an OTP for a given identifier (phone/email).

    Args:
        redis: Redis connection
        identifier: Phone number or email
        purpose: OTP purpose (login, register, reset_password, verify_email, verify_phone)

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
    await redis.hset(otp_key, mapping=otp_data)
    await redis.expire(otp_key, OTP_EXPIRY_SECONDS)

    # Set rate limit
    await redis.setex(rate_key, OTP_RATE_LIMIT_SECONDS, "1")

    # If identifier is an email, trigger SMTP delivery
    if "@" in identifier:
        await send_otp_via_email(identifier, otp)

    result = {
        "success": True,
        "message": f"OTP sent to {_mask_identifier(identifier)}",
        "expires_in": OTP_EXPIRY_SECONDS,
    }

    # Include OTP in response only in debug mode (for testing)
    if settings.APP_DEBUG:
        result["otp"] = otp

    await logger.ainfo("OTP generated and sent", identifier=_mask_identifier(identifier), purpose=purpose)

    return result


async def send_otp_via_email(email: str, otp: str) -> None:
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
    msg["Subject"] = f"{otp} is your SabjiWala login OTP"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = email

    # HTML body
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #10b981; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">SabjiWala.in</h1>
            <p style="color: #d1fae5; margin: 4px 0 0 0; font-size: 14px;">Farm Fresh Vegetables in 10 Minutes</p>
          </div>
          <div style="padding: 32px; text-align: center;">
            <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #1e293b;">Your One-Time Password (OTP)</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Use the following OTP to log in to your SabjiWala account. This OTP is valid for 5 minutes.</p>
            <div style="background-color: #f1f5f9; padding: 16px 24px; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #059669; display: inline-block; margin-bottom: 24px;">
              {otp}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you did not request this OTP, please ignore this email or contact support.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
            &copy; 2026 SabjiWala.in. All rights reserved.
          </div>
        </div>
      </body>
    </html>
    """
    
    # Attach plain text and HTML
    plain_text = f"Your SabjiWala login OTP is: {otp}. Valid for 5 minutes."
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.SMTP_USE_TLS,
            start_tls=settings.SMTP_START_TLS,
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
    otp_data = await redis.hgetall(otp_key)

    if not otp_data:
        return {"success": False, "message": "OTP expired or not found"}

    # Decode bytes if needed
    stored_otp = otp_data.get(b"otp", otp_data.get("otp", ""))
    attempts = otp_data.get(b"attempts", otp_data.get("attempts", "0"))
    if isinstance(stored_otp, bytes):
        stored_otp = stored_otp.decode()
    if isinstance(attempts, bytes):
        attempts = attempts.decode()

    attempts = int(attempts)

    # Check max attempts
    if attempts >= OTP_MAX_ATTEMPTS:
        await redis.delete(otp_key)
        return {"success": False, "message": "Maximum verification attempts exceeded"}

    # Increment attempts
    await redis.hset(otp_key, "attempts", str(attempts + 1))

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
