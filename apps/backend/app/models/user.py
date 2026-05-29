"""
User domain models — users, profiles, addresses, devices, sessions, MFA, RBAC.
"""
import enum
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseEntity


class UserType(str, enum.Enum):
    CUSTOMER = "customer"
    VENDOR = "vendor"
    DELIVERY_BOY = "delivery_boy"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    SUPPORT_AGENT = "support_agent"


class AuthProvider(str, enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"
    FACEBOOK = "facebook"
    APPLE = "apple"


class User(BaseEntity):
    __tablename__ = "users"

    # Core fields
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)

    # Names
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")

    # Type
    user_type: Mapped[UserType] = mapped_column(
        Enum(UserType, name="user_type_enum", create_constraint=True),
        nullable=False,
        default=UserType.CUSTOMER,
        index=True,
    )

    # Auth
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider_enum", create_constraint=True),
        nullable=False,
        default=AuthProvider.LOCAL,
    )
    auth_provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # MFA
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Encrypted TOTP secret
    mfa_backup_codes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted JSON array

    # Avatar
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Referral
    referral_code: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True, index=True)
    referred_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Metadata
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(back_populates="user", uselist=False, lazy="selectin")
    addresses: Mapped[List["UserAddress"]] = relationship(back_populates="user", lazy="selectin")
    devices: Mapped[List["UserDevice"]] = relationship(back_populates="user", lazy="noload")
    sessions: Mapped[List["UserSession"]] = relationship(back_populates="user", lazy="noload")
    user_roles: Mapped[List["UserRole"]] = relationship(back_populates="user", lazy="selectin")

    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active", "is_deleted"),
        Index("ix_users_phone_active", "phone", "is_active", "is_deleted"),
        Index("ix_users_type_active", "user_type", "is_active", "is_deleted"),
    )


class UserProfile(BaseEntity):
    __tablename__ = "user_profiles"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    currency: Mapped[str] = mapped_column(String(5), default="INR", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)

    user: Mapped["User"] = relationship(back_populates="profile")


class UserAddress(BaseEntity):
    __tablename__ = "user_addresss"  # BaseEntity adds 's', but table name overridden

    __tablename__ = "user_addresses"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    label: Mapped[str] = mapped_column(String(50), nullable=False, default="Home")
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address_line_1: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    address_line_2: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    place_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # OSM place ID
    formatted_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="addresses")

    __table_args__ = (
        Index("ix_user_addresses_user_default", "user_id", "is_default", "is_deleted"),
        Index("ix_user_addresses_latlon", "latitude", "longitude"),
    )


class UserDevice(BaseEntity):
    __tablename__ = "user_devices"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    device_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    device_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    device_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # android, ios, web
    os_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    app_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    push_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_trusted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fingerprint: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship(back_populates="devices")

    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_user_device"),
    )


class UserSession(BaseEntity):
    __tablename__ = "user_sessions"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    device_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("user_devices.id"), nullable=True,
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="sessions")

    __table_args__ = (
        Index("ix_sessions_user_active", "user_id", "is_active", "is_deleted"),
        Index("ix_sessions_token", "refresh_token_hash"),
    )


# ===== RBAC Models =====

class Role(BaseEntity):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Cannot be deleted
    parent_role_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id"), nullable=True,
    )
    hierarchy_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    role_permissions: Mapped[List["RolePermission"]] = relationship(back_populates="role", lazy="selectin")
    parent_role: Mapped[Optional["Role"]] = relationship(remote_side="Role.id", lazy="selectin")


class Permission(BaseEntity):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    module: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # create, read, update, delete, manage
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role_permissions: Mapped[List["RolePermission"]] = relationship(back_populates="permission")

    __table_args__ = (
        Index("ix_permissions_module_action", "module", "action"),
    )


class RolePermission(BaseEntity):
    __tablename__ = "role_permissions"

    role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    permission_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class UserRole(BaseEntity):
    __tablename__ = "user_roles"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    user: Mapped["User"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(lazy="selectin")

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    )


class PermissionGroup(BaseEntity):
    __tablename__ = "permission_groups"

    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permission_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)


# ===== Audit & Security Models =====

class AuditLog(BaseEntity):
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    changes: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    request_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    __table_args__ = (
        Index("ix_audit_logs_user_action", "user_id", "action", "created_at"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )


class ActivityLog(BaseEntity):
    __tablename__ = "activity_logs"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False, index=True)
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    __table_args__ = (
        Index("ix_activity_logs_user_type", "user_id", "activity_type", "created_at"),
    )


class SecurityLog(BaseEntity):
    __tablename__ = "security_logs"

    user_id: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")  # info, warning, critical
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_security_logs_event_severity", "event_type", "severity", "created_at"),
    )
