"""
BaseEntity Architecture - Foundation for all database models.

Every model in the system inherits from BaseEntity which provides:
- UUID7 primary key (time-sortable)
- Soft delete support (deleted_at, deleted_by)
- Full audit trail (created_at/by, updated_at/by)
- Optimistic locking via version column
- Automatic __tablename__ derivation
"""
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Boolean,
    text,
    event,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    declared_attr,
    Session,
)
from uuid6 import uuid7


def _camel_to_snake(name: str) -> str:
    """Convert CamelCase class name to snake_case table name."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


class BaseEntity(Base):
    """
    Abstract base entity providing common columns for all models.

    Features:
    - UUID7 primary key (time-ordered for index performance)
    - Soft delete pattern (is_deleted flag + deleted_at timestamp)
    - Full audit columns (created/updated/deleted by + at)
    - Version column for optimistic locking
    - Auto-derived table name from class name
    """

    __abstract__ = True

    @declared_attr.directive
    def __tablename__(cls) -> str:
        return _camel_to_snake(cls.__name__) + "s"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
        server_default=text("gen_random_uuid()"),
        index=True,
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    deleted_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        default=None,
    )

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Audit user references (nullable because system operations have no user)
    created_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        default=None,
    )
    updated_by: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        default=None,
    )

    # Optimistic locking
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default=text("1"),
        nullable=False,
    )

    def soft_delete(self, deleted_by_id: Optional[UUID] = None) -> None:
        """Mark this entity as soft-deleted."""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = deleted_by_id

    def restore(self) -> None:
        """Restore a soft-deleted entity."""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"


class TimestampMixin:
    """Mixin for models that only need timestamps without full BaseEntity features."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
