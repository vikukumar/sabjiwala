"""
MFA (Multi-Factor Authentication) — TOTP generation, verification, QR codes, backup codes.
"""
import secrets
import io
import base64
from typing import List, Tuple

import pyotp
import qrcode
import qrcode.constants

from app.core.config import settings


def generate_totp_secret() -> str:
    """Generate a new TOTP secret key."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Generate the provisioning URI for authenticator apps."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(
        name=email,
        issuer_name=settings.APP_NAME,
    )


def generate_qr_code(uri: str) -> str:
    """Generate a QR code image as base64-encoded PNG."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code. Allows ±1 time window for clock drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count: int = 10) -> List[str]:
    """Generate a set of single-use backup codes."""
    codes = []
    for _ in range(count):
        # Generate 8-character alphanumeric codes in format XXXX-XXXX
        raw = secrets.token_hex(4).upper()
        code = f"{raw[:4]}-{raw[4:]}"
        codes.append(code)
    return codes


def verify_backup_code(code: str, stored_codes: List[str]) -> Tuple[bool, List[str]]:
    """
    Verify a backup code. Returns (is_valid, remaining_codes).
    Consumes the code if valid.
    """
    normalized = code.strip().upper()
    if normalized in stored_codes:
        remaining = [c for c in stored_codes if c != normalized]
        return True, remaining
    return False, stored_codes


def setup_mfa(email: str) -> dict:
    """
    Set up MFA for a user. Returns secret, QR code, and backup codes.
    """
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, email)
    qr_code = generate_qr_code(uri)
    backup_codes = generate_backup_codes()

    return {
        "secret": secret,
        "uri": uri,
        "qr_code": qr_code,  # base64 PNG
        "backup_codes": backup_codes,
    }
