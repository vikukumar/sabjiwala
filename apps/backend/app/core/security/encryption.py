"""
AES-256-GCM Encryption — for data at rest (file storage, sensitive fields).
"""
import base64
import os
import secrets
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_encryption_key() -> bytes:
    """Get the encryption key from settings, or generate a warning default."""
    key_hex = settings.STORAGE_ENCRYPTION_KEY
    if key_hex and len(key_hex) >= 64:
        return bytes.fromhex(key_hex[:64])
    # Derive from app secret if no explicit key configured
    import hashlib
    return hashlib.sha256(settings.APP_SECRET_KEY.encode()).digest()


def encrypt_data(plaintext: bytes) -> bytes:
    """
    Encrypt data using AES-256-GCM.
    Returns: nonce (12 bytes) || ciphertext || tag (16 bytes)
    """
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def decrypt_data(encrypted: bytes) -> bytes:
    """
    Decrypt AES-256-GCM encrypted data.
    Expects: nonce (12 bytes) || ciphertext || tag (16 bytes)
    """
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = encrypted[:12]
    ciphertext = encrypted[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)


def encrypt_string(plaintext: str) -> str:
    """Encrypt a string and return base64-encoded result."""
    encrypted = encrypt_data(plaintext.encode("utf-8"))
    return base64.b64encode(encrypted).decode("ascii")


def decrypt_string(encrypted_b64: str) -> str:
    """Decrypt a base64-encoded encrypted string."""
    encrypted = base64.b64decode(encrypted_b64)
    decrypted = decrypt_data(encrypted)
    return decrypted.decode("utf-8")


def encrypt_file(input_path: str, output_path: str) -> None:
    """Encrypt a file using AES-256-GCM."""
    with open(input_path, "rb") as f:
        plaintext = f.read()

    encrypted = encrypt_data(plaintext)

    with open(output_path, "wb") as f:
        f.write(encrypted)


def decrypt_file(input_path: str, output_path: str) -> None:
    """Decrypt a file encrypted with AES-256-GCM."""
    with open(input_path, "rb") as f:
        encrypted = f.read()

    decrypted = decrypt_data(encrypted)

    with open(output_path, "wb") as f:
        f.write(decrypted)


def generate_encryption_key() -> str:
    """Generate a new 256-bit encryption key as hex string."""
    return secrets.token_hex(32)
