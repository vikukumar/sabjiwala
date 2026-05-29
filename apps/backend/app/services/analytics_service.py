"""
Analytics and Dashboard Metrics Aggregator Service.
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus
from app.models.vendor import Vendor, VendorWallet
from app.models.user import User, UserType
from app.models.payment import Payment, PaymentStatus


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_admin_dashboard_metrics(self) -> Dict[str, Any]:
        """Aggregate stats for administrative dashboard."""
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # Total revenue & orders (all time)
        rev_res = await self.db.execute(
            select(
                func.sum(Order.total_amount),
                func.count(Order.id),
                func.sum(Order.subtotal)
            )
            .where(Order.status == OrderStatus.DELIVERED, Order.is_deleted == False)
        )
        total_rev, total_orders, total_subtotal = rev_res.first() or (0.0, 0, 0.0)
        total_rev = float(total_rev or 0.0)
        total_subtotal = float(total_subtotal or 0.0)

        # Commission (estimated at 5% of subtotal)
        total_commission = total_subtotal * 0.05

        # Active users count
        users_res = await self.db.execute(
            select(func.count(User.id)).where(User.is_active == True, User.is_deleted == False)
        )
        active_users = users_res.scalar() or 0

        # Active vendors count
        vendors_res = await self.db.execute(
            select(func.count(Vendor.id)).where(Vendor.is_deleted == False)
        )
        active_vendors = vendors_res.scalar() or 0

        # Last 30 days metrics
        thirty_days_res = await self.db.execute(
            select(
                func.sum(Order.total_amount),
                func.count(Order.id)
            )
            .where(
                Order.status == OrderStatus.DELIVERED,
                Order.actual_delivery_time >= thirty_days_ago,
                Order.is_deleted == False
            )
        )
        recent_rev, recent_orders = thirty_days_res.first() or (0.0, 0)
        recent_rev = float(recent_rev or 0.0)

        return {
            "total_revenue": total_rev,
            "total_orders": total_orders,
            "estimated_commission": total_commission,
            "active_users": active_users,
            "active_vendors": active_vendors,
            "recent_30d_revenue": recent_rev,
            "recent_30d_orders": recent_orders,
        }

    async def get_vendor_dashboard_metrics(self, vendor_id: UUID) -> Dict[str, Any]:
        """Aggregate stats for vendor-specific dashboard."""
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # Sales & orders count (all time)
        rev_res = await self.db.execute(
            select(
                func.sum(Order.subtotal),
                func.count(Order.id)
            )
            .where(
                Order.vendor_id == vendor_id,
                Order.status == OrderStatus.DELIVERED,
                Order.is_deleted == False
            )
        )
        total_sales, total_orders = rev_res.first() or (0.0, 0)
        total_sales = float(total_sales or 0.0)

        # Wallet balance
        wallet_res = await self.db.execute(
            select(VendorWallet.balance, VendorWallet.pending_balance)
            .where(VendorWallet.vendor_id == vendor_id)
        )
        wallet = wallet_res.first()
        wallet_balance, pending_balance = (float(wallet[0]), float(wallet[1])) if wallet else (0.0, 0.0)

        # 30-day metrics
        recent_res = await self.db.execute(
            select(
                func.sum(Order.subtotal),
                func.count(Order.id)
            )
            .where(
                Order.vendor_id == vendor_id,
                Order.status == OrderStatus.DELIVERED,
                Order.actual_delivery_time >= thirty_days_ago,
                Order.is_deleted == False
            )
        )
        recent_sales, recent_orders = recent_res.first() or (0.0, 0)
        recent_sales = float(recent_sales or 0.0)

        # Order status distribution
        status_res = await self.db.execute(
            select(Order.status, func.count(Order.id))
            .where(Order.vendor_id == vendor_id, Order.is_deleted == False)
            .group_by(Order.status)
        )
        status_dist = {row[0].value: row[1] for row in status_res.fetchall()}

        return {
            "total_sales": total_sales,
            "total_orders": total_orders,
            "wallet_balance": wallet_balance,
            "pending_balance": pending_balance,
            "recent_30d_sales": recent_sales,
            "recent_30d_orders": recent_orders,
            "order_status_distribution": status_dist,
        }
