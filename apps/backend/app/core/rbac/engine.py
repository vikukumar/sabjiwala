"""
RBAC Engine — Hierarchical Role-Based Access Control with permission resolution and caching.
"""
from functools import wraps
from typing import List, Optional, Set
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import Permission, Role, RolePermission, User, UserRole

logger = structlog.get_logger()

PERMISSION_CACHE_PREFIX = "rbac:perms:"
PERMISSION_CACHE_TTL = 300  # 5 minutes


class RBACEngine:
    """Hierarchical RBAC engine with permission caching."""

    async def get_user_permissions(
        self,
        user_id: UUID,
        db: AsyncSession,
        redis: Optional[Redis] = None,
    ) -> Set[str]:
        """
        Get all permissions for a user, including inherited permissions from role hierarchy.

        Checks Redis cache first, falls back to database query.
        """
        # Try cache
        if redis:
            cache_key = f"{PERMISSION_CACHE_PREFIX}{user_id}"
            cached = await redis.smembers(cache_key)
            if cached:
                return {p.decode() if isinstance(p, bytes) else p for p in cached}

        # Query database
        permissions = set()

        # Get all roles for the user
        result = await db.execute(
            select(UserRole)
            .options(selectinload(UserRole.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(UserRole.user_id == user_id, UserRole.is_deleted == False)
        )
        user_roles = result.scalars().all()

        for user_role in user_roles:
            role = user_role.role
            if role:
                # Collect permissions from this role
                role_perms = await self._collect_role_permissions(role, db)
                permissions.update(role_perms)

        # Cache in Redis
        if redis and permissions:
            cache_key = f"{PERMISSION_CACHE_PREFIX}{user_id}"
            await redis.sadd(cache_key, *permissions)
            await redis.expire(cache_key, PERMISSION_CACHE_TTL)

        return permissions

    async def _collect_role_permissions(
        self,
        role: Role,
        db: AsyncSession,
        visited: Optional[set] = None,
    ) -> Set[str]:
        """Recursively collect permissions from a role and its parent roles."""
        if visited is None:
            visited = set()

        if role.id in visited:
            return set()  # Prevent circular references

        visited.add(role.id)
        permissions = set()

        # Permissions from this role
        for rp in role.role_permissions:
            if rp.permission:
                permissions.add(rp.permission.code)

        # Inherited permissions from parent role
        if role.parent_role_id and role.parent_role:
            parent_perms = await self._collect_role_permissions(role.parent_role, db, visited)
            permissions.update(parent_perms)

        return permissions

    async def has_permission(
        self,
        user_id: UUID,
        permission_code: str,
        db: AsyncSession,
        redis: Optional[Redis] = None,
    ) -> bool:
        """Check if a user has a specific permission."""
        permissions = await self.get_user_permissions(user_id, db, redis)
        # Check for exact match or wildcard (e.g., "orders.*" matches "orders.read")
        if permission_code in permissions:
            return True
        # Check wildcard permissions
        module = permission_code.split(".")[0] if "." in permission_code else ""
        if f"{module}.*" in permissions:
            return True
        if "*" in permissions:
            return True
        return False

    async def has_any_permission(
        self,
        user_id: UUID,
        permission_codes: List[str],
        db: AsyncSession,
        redis: Optional[Redis] = None,
    ) -> bool:
        """Check if a user has any of the specified permissions."""
        permissions = await self.get_user_permissions(user_id, db, redis)
        for code in permission_codes:
            if code in permissions:
                return True
            module = code.split(".")[0] if "." in code else ""
            if f"{module}.*" in permissions or "*" in permissions:
                return True
        return False

    async def has_all_permissions(
        self,
        user_id: UUID,
        permission_codes: List[str],
        db: AsyncSession,
        redis: Optional[Redis] = None,
    ) -> bool:
        """Check if a user has all of the specified permissions."""
        for code in permission_codes:
            if not await self.has_permission(user_id, code, db, redis):
                return False
        return True

    async def invalidate_cache(self, user_id: UUID, redis: Redis) -> None:
        """Invalidate the permission cache for a user."""
        cache_key = f"{PERMISSION_CACHE_PREFIX}{user_id}"
        await redis.delete(cache_key)

    async def get_user_roles(
        self,
        user_id: UUID,
        db: AsyncSession,
    ) -> List[Role]:
        """Get all roles assigned to a user."""
        result = await db.execute(
            select(UserRole)
            .options(selectinload(UserRole.role))
            .where(UserRole.user_id == user_id, UserRole.is_deleted == False)
        )
        user_roles = result.scalars().all()
        return [ur.role for ur in user_roles if ur.role]


# Singleton
rbac_engine = RBACEngine()


# ===== FastAPI Dependencies =====

async def get_current_user(request: Request) -> dict:
    """
    Extract and validate the current user from the JWT token in the Authorization header.
    Returns a dict with user_id, user_type, permissions, device_id.
    """
    from app.core.security.jwt import decode_token, is_token_blacklisted
    import jwt as pyjwt

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1]

    try:
        payload = decode_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if token type is access
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # Check blacklist (via Redis if available)
    redis: Optional[Redis] = getattr(request.app.state, "redis", None)
    if redis:
        jti = payload.get("jti", "")
        if await is_token_blacklisted(redis, jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
            )

    return {
        "user_id": UUID(payload["sub"]),
        "user_type": payload.get("user_type", "customer"),
        "permissions": payload.get("permissions", []),
        "device_id": payload.get("device_id"),
        "jti": payload.get("jti"),
    }


def require_permissions(*permissions: str):
    """
    FastAPI dependency factory that requires specific permissions.

    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_permissions("users.read"))])
    """
    async def _check(
        request: Request,
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        user_id = current_user["user_id"]
        redis: Optional[Redis] = getattr(request.app.state, "redis", None)

        has_perms = await rbac_engine.has_all_permissions(
            user_id, list(permissions), db, redis
        )

        if not has_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {', '.join(permissions)}",
            )

        return current_user

    return Depends(_check)


def require_any_permission(*permissions: str):
    """Require any one of the specified permissions."""
    async def _check(
        request: Request,
        current_user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        user_id = current_user["user_id"]
        redis: Optional[Redis] = getattr(request.app.state, "redis", None)

        has_perms = await rbac_engine.has_any_permission(
            user_id, list(permissions), db, redis
        )

        if not has_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return Depends(_check)


def require_user_type(*user_types: str):
    """Require the user to be of a specific type."""
    async def _check(current_user: dict = Depends(get_current_user)):
        if current_user["user_type"] not in user_types:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This endpoint requires user type: {', '.join(user_types)}",
            )
        return current_user

    return Depends(_check)
