"""
RBAC Seed — Default roles, permissions, and their assignments.
Creates the standard permission matrix on first startup.
"""
from typing import List, Optional
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Permission, Role, RolePermission

logger = structlog.get_logger()

# Complete permission matrix organized by module
PERMISSIONS = {
    # Users
    "users": ["create", "read", "update", "delete", "manage", "ban", "impersonate"],
    # Vendors
    "vendors": ["create", "read", "update", "delete", "verify", "approve", "suspend", "manage"],
    # Products
    "products": ["create", "read", "update", "delete", "manage", "import", "export"],
    # Categories
    "categories": ["create", "read", "update", "delete", "manage"],
    # Inventory
    "inventory": ["read", "update", "manage", "import"],
    # Orders
    "orders": ["read", "update", "cancel", "refund", "manage", "assign", "track"],
    # Payments
    "payments": ["read", "refund", "manage", "settlements"],
    # Coupons
    "coupons": ["create", "read", "update", "delete", "manage"],
    # Offers
    "offers": ["create", "read", "update", "delete", "manage"],
    # Delivery
    "delivery": ["read", "assign", "track", "manage"],
    # Delivery Boys
    "delivery_boys": ["create", "read", "update", "delete", "manage"],
    # Support
    "support": ["read", "respond", "assign", "close", "manage"],
    # Disputes
    "disputes": ["read", "resolve", "escalate", "manage"],
    # Notifications
    "notifications": ["read", "create", "manage", "templates"],
    # CMS
    "cms": ["read", "create", "update", "delete", "publish", "manage"],
    # Banners
    "banners": ["create", "read", "update", "delete", "manage"],
    # Advertisements
    "advertisements": ["create", "read", "update", "delete", "manage"],
    # Reports
    "reports": ["read", "export", "manage"],
    # Analytics
    "analytics": ["read", "manage"],
    # RBAC
    "rbac": ["read", "manage", "assign_roles"],
    # Settings
    "settings": ["read", "update", "manage"],
    # Audit
    "audit": ["read", "manage"],
    # Storage
    "storage": ["upload", "read", "delete", "manage"],
    # Wallets
    "wallets": ["read", "credit", "debit", "manage"],
    # Payouts
    "payouts": ["read", "approve", "process", "manage"],
    # Installation
    "installation": ["manage"],
}

# Role definitions with hierarchy levels
ROLES = [
    {
        "name": "super_admin",
        "display_name": "Super Admin",
        "description": "Full platform access — can manage everything",
        "hierarchy_level": 100,
        "parent": None,
        "permissions": ["*"],  # All permissions
    },
    {
        "name": "admin",
        "display_name": "Admin",
        "description": "Platform administrator with broad access",
        "hierarchy_level": 90,
        "parent": "super_admin",
        "permissions": [
            "users.*", "vendors.*", "products.*", "categories.*", "inventory.*",
            "orders.*", "payments.read", "payments.refund", "coupons.*", "offers.*",
            "delivery.*", "delivery_boys.*", "support.*", "disputes.*",
            "notifications.*", "cms.*", "banners.*", "advertisements.*",
            "reports.*", "analytics.*", "settings.read", "settings.update",
            "audit.read", "storage.*", "wallets.read", "payouts.*",
        ],
    },
    {
        "name": "support_agent",
        "display_name": "Support Agent",
        "description": "Customer support with limited access",
        "hierarchy_level": 50,
        "parent": "admin",
        "permissions": [
            "users.read", "vendors.read", "products.read", "orders.read", "orders.update",
            "support.*", "disputes.read", "disputes.resolve", "notifications.read",
            "notifications.create", "reports.read", "wallets.read",
        ],
    },
    {
        "name": "vendor",
        "display_name": "Vendor",
        "description": "Vendor store owner",
        "hierarchy_level": 30,
        "parent": None,
        "permissions": [
            "products.create", "products.read", "products.update", "products.delete",
            "products.import", "categories.read", "inventory.read", "inventory.update",
            "inventory.import", "orders.read", "orders.update", "orders.assign",
            "coupons.create", "coupons.read", "coupons.update", "coupons.delete",
            "offers.create", "offers.read", "offers.update", "offers.delete",
            "delivery_boys.create", "delivery_boys.read", "delivery_boys.update",
            "delivery.assign", "delivery.track", "support.read", "support.respond",
            "notifications.read", "reports.read", "reports.export",
            "analytics.read", "storage.upload", "storage.read",
            "wallets.read", "payouts.read",
        ],
    },
    {
        "name": "vendor_manager",
        "display_name": "Vendor Manager",
        "description": "Vendor staff with management capabilities",
        "hierarchy_level": 25,
        "parent": "vendor",
        "permissions": [
            "products.read", "products.update", "categories.read",
            "inventory.read", "inventory.update", "orders.read", "orders.update",
            "delivery.assign", "delivery.track", "notifications.read",
            "reports.read", "storage.upload", "storage.read",
        ],
    },
    {
        "name": "delivery_boy",
        "display_name": "Delivery Boy",
        "description": "Delivery personnel",
        "hierarchy_level": 10,
        "parent": None,
        "permissions": [
            "orders.read", "orders.update", "orders.track",
            "delivery.track", "notifications.read",
            "wallets.read",
        ],
    },
    {
        "name": "customer",
        "display_name": "Customer",
        "description": "Regular customer",
        "hierarchy_level": 0,
        "parent": None,
        "permissions": [
            "products.read", "categories.read", "orders.read",
            "orders.track", "support.read", "support.respond",
            "notifications.read", "storage.upload", "storage.read",
            "wallets.read",
        ],
    },
]


async def seed_default_roles_and_permissions(db: AsyncSession) -> None:
    """
    Seed default roles and permissions. Idempotent — skips already existing records.
    """
    # 1. Create all permissions
    existing_perms = {}
    result = await db.execute(select(Permission).where(Permission.is_deleted == False))
    for perm in result.scalars().all():
        existing_perms[perm.code] = perm

    created_perms = 0
    all_perms = {}

    for module, actions in PERMISSIONS.items():
        for action in actions:
            code = f"{module}.{action}"
            if code not in existing_perms:
                perm = Permission(
                    code=code,
                    name=f"{module.replace('_', ' ').title()} - {action.title()}",
                    description=f"Permission to {action} {module}",
                    module=module,
                    action=action,
                    is_system=True,
                )
                db.add(perm)
                all_perms[code] = perm
                created_perms += 1
            else:
                all_perms[code] = existing_perms[code]

    if created_perms > 0:
        await db.flush()
        await logger.ainfo(f"Created {created_perms} permissions")

    # 2. Create all roles
    existing_roles = {}
    result = await db.execute(select(Role).where(Role.is_deleted == False))
    for role in result.scalars().all():
        existing_roles[role.name] = role

    created_roles = 0
    role_objects = {}

    for role_def in ROLES:
        if role_def["name"] not in existing_roles:
            parent_id = None
            if role_def["parent"] and role_def["parent"] in role_objects:
                parent_id = role_objects[role_def["parent"]].id
            elif role_def["parent"] and role_def["parent"] in existing_roles:
                parent_id = existing_roles[role_def["parent"]].id

            role = Role(
                name=role_def["name"],
                display_name=role_def["display_name"],
                description=role_def["description"],
                hierarchy_level=role_def["hierarchy_level"],
                parent_role_id=parent_id,
                is_system=True,
            )
            db.add(role)
            role_objects[role_def["name"]] = role
            created_roles += 1
        else:
            role_objects[role_def["name"]] = existing_roles[role_def["name"]]

    if created_roles > 0:
        await db.flush()
        await logger.ainfo(f"Created {created_roles} roles")

    # 3. Assign permissions to roles
    # Get existing role-permission mappings
    existing_rp = set()
    result = await db.execute(select(RolePermission).where(RolePermission.is_deleted == False))
    for rp in result.scalars().all():
        existing_rp.add((rp.role_id, rp.permission_id))

    created_rp = 0

    for role_def in ROLES:
        role = role_objects.get(role_def["name"])
        if not role:
            continue

        for perm_code in role_def["permissions"]:
            if perm_code == "*":
                # Assign all permissions
                for p in all_perms.values():
                    if (role.id, p.id) not in existing_rp:
                        rp = RolePermission(role_id=role.id, permission_id=p.id)
                        db.add(rp)
                        created_rp += 1
            elif perm_code.endswith(".*"):
                # Assign all permissions for a module
                module = perm_code.replace(".*", "")
                for code, p in all_perms.items():
                    if code.startswith(f"{module}."):
                        if (role.id, p.id) not in existing_rp:
                            rp = RolePermission(role_id=role.id, permission_id=p.id)
                            db.add(rp)
                            created_rp += 1
            else:
                p = all_perms.get(perm_code)
                if p and (role.id, p.id) not in existing_rp:
                    rp = RolePermission(role_id=role.id, permission_id=p.id)
                    db.add(rp)
                    created_rp += 1

    if created_rp > 0:
        await db.flush()
        await logger.ainfo(f"Created {created_rp} role-permission assignments")

    await logger.ainfo(
        "RBAC seed complete",
        permissions=len(all_perms),
        roles=len(role_objects),
        new_permissions=created_perms,
        new_roles=created_roles,
        new_assignments=created_rp,
    )
