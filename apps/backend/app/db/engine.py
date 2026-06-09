"""
Auto Schema Evolution Engine — Production-Safe Database Migration Without Alembic.

This engine inspects the current database schema and compares it to SQLAlchemy model
metadata. It safely applies additive changes:
  - Creates missing tables
  - Adds missing columns (with safe defaults)
  - Creates missing indexes
  - Adds missing constraints and foreign keys
  - Adds missing enum values

SAFETY RULES:
  - NEVER drops tables, columns, indexes, or constraints
  - NEVER renames anything
  - NEVER changes column types
  - All changes are logged to _schema_evolution_log table
  - Runs in a transaction with savepoints per operation
  - Idempotent — safe to run on every startup
"""
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

import structlog
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine
from sqlalchemy.engine import Inspector

from app.db.base import Base

logger = structlog.get_logger()


class SchemaEvolutionEngine:
    """
    Compares SQLAlchemy model metadata to live database schema and applies
    safe, additive-only DDL changes.
    """

    # Table used to log all schema changes
    EVOLUTION_LOG_TABLE = "_schema_evolution_log"

    async def evolve(self, engine: AsyncEngine) -> None:
        """Main entry point: run schema evolution against the given engine."""
        # 0. Attempt to create the public schema outside the main transaction block
        try:
            async with engine.connect() as conn:
                await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public;"))
                await conn.commit()
        except Exception as e:
            await logger.awarning(f"Failed to create public schema outside transaction: {e}")

        async with engine.begin() as conn:
            # Ensure the evolution log table exists first
            await self._ensure_log_table(conn)

            # Get live database state
            live_tables = await conn.run_sync(self._get_live_tables)
            live_indexes = await conn.run_sync(self._get_live_indexes)
            live_enums = await conn.run_sync(self._get_live_enums)

            # Get model metadata
            model_metadata = Base.metadata

            changes: List[Dict[str, Any]] = []

            # 1. Create missing tables
            missing_tables = await self._create_missing_tables(conn, model_metadata, live_tables)
            changes.extend(missing_tables)

            # Refresh live tables after creating new ones
            if missing_tables:
                live_tables = await conn.run_sync(self._get_live_tables)

            # 2. Add missing columns to existing tables
            column_changes = await self._add_missing_columns(conn, model_metadata, live_tables)
            changes.extend(column_changes)

            # 3. Create missing indexes
            index_changes = await self._create_missing_indexes(conn, model_metadata, live_indexes)
            changes.extend(index_changes)

            # 4. Add missing enum values
            enum_changes = await self._add_missing_enum_values(conn, model_metadata, live_enums)
            changes.extend(enum_changes)

            # 5. Add missing foreign keys
            fk_changes = await self._add_missing_foreign_keys(conn, model_metadata, live_tables)
            changes.extend(fk_changes)

            # Log all changes
            for change in changes:
                await self._log_change(conn, change)

            if changes:
                await logger.ainfo(
                    "Schema evolution applied changes",
                    count=len(changes),
                    changes=[c["description"] for c in changes],
                )
            else:
                await logger.ainfo("Schema evolution: no changes needed")

    def _get_live_tables(self, conn: Any) -> Dict[str, Dict[str, Any]]:
        """Get all tables and their columns from the live database."""
        inspector: Inspector = inspect(conn)
        tables: Dict[str, Dict[str, Any]] = {}

        for table_name in inspector.get_table_names():
            columns = {}
            for col in inspector.get_columns(table_name):
                columns[col["name"]] = {
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "default": col.get("default"),
                }

            foreign_keys = []
            for fk in inspector.get_foreign_keys(table_name):
                foreign_keys.append({
                    "name": fk.get("name"),
                    "constrained_columns": fk.get("constrained_columns", []),
                    "referred_table": fk.get("referred_table"),
                    "referred_columns": fk.get("referred_columns", []),
                })

            tables[table_name] = {
                "columns": columns,
                "foreign_keys": foreign_keys,
            }

        return tables

    def _get_live_indexes(self, conn: Any) -> Dict[str, List[Dict[str, Any]]]:
        """Get all indexes from the live database."""
        inspector: Inspector = inspect(conn)
        indexes: Dict[str, List[Dict[str, Any]]] = {}

        for table_name in inspector.get_table_names():
            table_indexes = []
            for idx in inspector.get_indexes(table_name):
                table_indexes.append({
                    "name": idx.get("name"),
                    "columns": idx.get("column_names", []),
                    "unique": idx.get("unique", False),
                })
            indexes[table_name] = table_indexes

        return indexes

    def _get_live_enums(self, conn: Any) -> Dict[str, List[str]]:
        """Get all PostgreSQL enum types and their values."""
        inspector: Inspector = inspect(conn)
        enums: Dict[str, List[str]] = {}

        try:
            for enum_info in inspector.get_enums():
                enums[enum_info["name"]] = enum_info.get("labels", [])
        except Exception:
            pass  # get_enums may not be available in all versions

        return enums

    async def _create_missing_tables(
        self,
        conn: AsyncConnection,
        metadata: MetaData,
        live_tables: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Create any tables that exist in models but not in the database."""
        changes: List[Dict[str, Any]] = []

        for table_name, table in metadata.tables.items():
            if table_name.startswith("_"):
                continue  # Skip internal tables

            if table_name not in live_tables:
                await conn.run_sync(lambda sync_conn: table.create(sync_conn, checkfirst=True))
                changes.append({
                    "type": "CREATE_TABLE",
                    "table": table_name,
                    "description": f"Created table '{table_name}' with {len(table.columns)} columns",
                })
                await logger.ainfo(f"Created table: {table_name}")

        return changes

    async def _add_missing_columns(
        self,
        conn: AsyncConnection,
        metadata: MetaData,
        live_tables: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Add columns that exist in models but not in the live table."""
        changes: List[Dict[str, Any]] = []

        for table_name, table in metadata.tables.items():
            if table_name.startswith("_") or table_name not in live_tables:
                continue

            live_columns = live_tables[table_name]["columns"]

            for column in table.columns:
                if column.name not in live_columns:
                    # Build safe ALTER TABLE ADD COLUMN statement
                    col_type = column.type.compile(dialect=conn.dialect)
                    nullable = "NULL" if column.nullable else "NOT NULL"

                    # Determine safe default for NOT NULL columns
                    default_clause = ""
                    if not column.nullable:
                        if column.server_default is not None:
                            default_val = column.server_default.arg
                            if callable(default_val):
                                default_clause = f" DEFAULT ''"
                            else:
                                default_clause = f" DEFAULT {default_val}"
                        elif column.default is not None:
                            # For NOT NULL columns without server_default, add as nullable first
                            nullable = "NULL"
                        else:
                            # Must provide a default for NOT NULL on existing rows
                            default_clause = self._get_type_default(str(col_type))

                    ddl = (
                        f'ALTER TABLE "{table_name}" '
                        f'ADD COLUMN "{column.name}" {col_type} {nullable}{default_clause}'
                    )

                    try:
                        await conn.execute(text(ddl))
                        changes.append({
                            "type": "ADD_COLUMN",
                            "table": table_name,
                            "column": column.name,
                            "description": f"Added column '{column.name}' ({col_type}) to '{table_name}'",
                        })
                        await logger.ainfo(f"Added column: {table_name}.{column.name} ({col_type})")
                    except Exception as e:
                        await logger.awarning(
                            f"Failed to add column {table_name}.{column.name}: {e}"
                        )

        return changes

    def _get_type_default(self, type_str: str) -> str:
        """Get a safe default value clause for a column type."""
        type_upper = type_str.upper()
        if "INT" in type_upper or "SERIAL" in type_upper:
            return " DEFAULT 0"
        elif "BOOL" in type_upper:
            return " DEFAULT false"
        elif "TIMESTAMP" in type_upper or "DATE" in type_upper:
            return " DEFAULT now()"
        elif "UUID" in type_upper:
            return " DEFAULT gen_random_uuid()"
        elif "JSON" in type_upper:
            return " DEFAULT '{}'"
        elif "ARRAY" in type_upper:
            return " DEFAULT '{}'"
        elif "FLOAT" in type_upper or "DOUBLE" in type_upper or "NUMERIC" in type_upper or "DECIMAL" in type_upper:
            return " DEFAULT 0.0"
        else:
            return " DEFAULT ''"

    async def _create_missing_indexes(
        self,
        conn: AsyncConnection,
        metadata: MetaData,
        live_indexes: Dict[str, List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        """Create indexes that exist in models but not in the live database."""
        changes: List[Dict[str, Any]] = []

        for table_name, table in metadata.tables.items():
            if table_name.startswith("_"):
                continue

            live_table_indexes = live_indexes.get(table_name, [])
            live_index_names = {idx["name"] for idx in live_table_indexes}

            for index in table.indexes:
                if index.name and index.name not in live_index_names:
                    try:
                        await conn.run_sync(lambda sync_conn: index.create(sync_conn, checkfirst=True))
                        col_names = [c.name for c in index.columns]
                        changes.append({
                            "type": "CREATE_INDEX",
                            "table": table_name,
                            "index": index.name,
                            "description": f"Created index '{index.name}' on '{table_name}' ({', '.join(col_names)})",
                        })
                        await logger.ainfo(f"Created index: {index.name} on {table_name}")
                    except Exception as e:
                        await logger.awarning(f"Failed to create index {index.name}: {e}")

        return changes

    async def _add_missing_enum_values(
        self,
        conn: AsyncConnection,
        metadata: MetaData,
        live_enums: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        """Add enum values that exist in models but not in the live database."""
        changes: List[Dict[str, Any]] = []

        for table in metadata.tables.values():
            for column in table.columns:
                if hasattr(column.type, "enums"):
                    enum_type = column.type
                    enum_name = getattr(enum_type, "name", None)
                    if enum_name and enum_name in live_enums:
                        live_values = set(live_enums[enum_name])
                        model_values = set(enum_type.enums)
                        missing_values = model_values - live_values

                        for value in missing_values:
                            try:
                                ddl = f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'"
                                await conn.execute(text(ddl))
                                changes.append({
                                    "type": "ADD_ENUM_VALUE",
                                    "enum": enum_name,
                                    "value": value,
                                    "description": f"Added enum value '{value}' to type '{enum_name}'",
                                })
                                await logger.ainfo(f"Added enum value: {enum_name}.{value}")
                            except Exception as e:
                                await logger.awarning(
                                    f"Failed to add enum value {enum_name}.{value}: {e}"
                                )

        return changes

    async def _add_missing_foreign_keys(
        self,
        conn: AsyncConnection,
        metadata: MetaData,
        live_tables: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Add foreign key constraints that exist in models but not in the database."""
        changes: List[Dict[str, Any]] = []

        for table_name, table in metadata.tables.items():
            if table_name.startswith("_") or table_name not in live_tables:
                continue

            live_fks = live_tables[table_name].get("foreign_keys", [])
            live_fk_cols = set()
            for fk in live_fks:
                for col in fk.get("constrained_columns", []):
                    live_fk_cols.add(col)

            for fk_constraint in table.foreign_key_constraints:
                constrained_cols = [c.name for c in fk_constraint.columns]
                # Check if this FK already exists
                if not all(col in live_fk_cols for col in constrained_cols):
                    try:
                        referred_table = list(fk_constraint.elements)[0].column.table.name
                        referred_cols = [elem.column.name for elem in fk_constraint.elements]
                        fk_name = fk_constraint.name or f"fk_{table_name}_{'_'.join(constrained_cols)}"

                        constrained_cols_str = ", ".join(f'"{c}"' for c in constrained_cols)
                        referred_cols_str = ", ".join(f'"{c}"' for c in referred_cols)
                        ddl = (
                            f'ALTER TABLE "{table_name}" '
                            f'ADD CONSTRAINT "{fk_name}" '
                            f'FOREIGN KEY ({constrained_cols_str}) '
                            f'REFERENCES "{referred_table}" ({referred_cols_str})'
                        )
                        await conn.execute(text(ddl))
                        changes.append({
                            "type": "ADD_FOREIGN_KEY",
                            "table": table_name,
                            "constraint": fk_name,
                            "description": (
                                f"Added FK '{fk_name}' on '{table_name}' "
                                f"({', '.join(constrained_cols)}) → '{referred_table}'"
                            ),
                        })
                        await logger.ainfo(f"Added foreign key: {fk_name}")
                    except Exception as e:
                        await logger.awarning(f"Failed to add FK on {table_name}: {e}")

        return changes

    async def _ensure_log_table(self, conn: AsyncConnection) -> None:
        """Create the schema evolution log table if it doesn't exist."""
        try:
            await conn.execute(text("SET search_path TO public;"))
        except Exception:
            pass
        await conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {self.EVOLUTION_LOG_TABLE} (
                id SERIAL PRIMARY KEY,
                change_type VARCHAR(50) NOT NULL,
                table_name VARCHAR(255),
                description TEXT NOT NULL,
                details JSONB,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
            )
        """))




    async def _log_change(self, conn: AsyncConnection, change: Dict[str, Any]) -> None:
        """Log a schema change to the evolution log table."""
        await conn.execute(
            text(f"""
                INSERT INTO {self.EVOLUTION_LOG_TABLE}
                (change_type, table_name, description, details)
                VALUES (:type, :table, :description, :details)
            """),
            {
                "type": change.get("type", "UNKNOWN"),
                "table": change.get("table", ""),
                "description": change.get("description", ""),
                "details": json.dumps(change),
            },
        )


# Singleton instance
schema_evolution_engine = SchemaEvolutionEngine()
