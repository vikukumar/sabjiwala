"""
Password hashing using Argon2id — the recommended algorithm for password storage.
"""
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# Configure Argon2id with secure defaults
_hasher = PasswordHasher(
    time_cost=3,        # Number of iterations
    memory_cost=65536,  # 64MB memory usage
    parallelism=4,      # Parallel threads
    hash_len=32,        # Output hash length
    salt_len=16,        # Salt length
)


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its Argon2id hash."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Check if a password hash needs to be updated to current parameters."""
    return _hasher.check_needs_rehash(password_hash)


def validate_password_strength(password: str) -> list[str]:
    """
    Validate password strength. Returns a list of issues (empty = strong password).
    """
    issues = []
    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")
    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one digit")
    if not any(c in "!@#$%^&*()_+-=[]{}|;:',.<>?/`~" for c in password):
        issues.append("Password must contain at least one special character")
    return issues
