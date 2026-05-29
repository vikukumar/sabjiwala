"""
Settlement Service to calculate vendor earnings and manage payouts.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List
from uuid import UUID

from sqlalchemy import select, update, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.payment import Settlement, VendorWallet
from app.models.order import Order, OrderStatus
from app.models.vendor import Vendor


class SettlementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_vendor_settlements(
        self,
        vendor_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[Settlement]:
        """
        Scan all DELIVERED orders in the period, calculate platform commission, net amount, and create settlement entry.
        """
        # Get vendor details
        vendor_res = await self.db.execute(select(Vendor).where(Vendor.id == vendor_id))
        vendor = vendor_res.scalars().first()
        if not vendor:
            return None

        # Fetch orders delivered within interval and not yet settled
        order_res = await self.db.execute(
            select(Order)
            .where(
                Order.vendor_id == vendor_id,
                Order.status == OrderStatus.DELIVERED,
                Order.actual_delivery_time >= start_date,
                Order.actual_delivery_time <= end_date,
                Order.is_deleted == False,
                # Avoid double settlement
                # We can store in metadata or trace settlements
            )
        )
        orders = order_res.scalars().all()
        if not orders:
            return None

        # Filter out orders already settled (e.g. check in existing settlements)
        existing_settlements_res = await self.db.execute(
            select(Settlement).where(Settlement.vendor_id == vendor_id)
        )
        settled_order_ids = set()
        for s in existing_settlements_res.scalars().all():
            if s.order_ids:
                settled_order_ids.update(UUID(oid) if isinstance(oid, str) else oid for oid in s.order_ids)

        active_orders = [o for o in orders if o.id not in settled_order_ids]
        if not active_orders:
            return None

        total_orders = len(active_orders)
        gross_amount = 0.0
        commission_amount = 0.0
        delivery_charges = 0.0
        refund_amount = 0.0
        order_ids_list = []

        commission_rate = vendor.commission_rate or 0.05  # Default 5% commission

        for order in active_orders:
            gross_amount += float(order.subtotal)
            commission_amount += float(order.subtotal) * commission_rate
            delivery_charges += float(order.delivery_charge)
            order_ids_list.append(str(order.id))

        net_amount = gross_amount - commission_amount + delivery_charges

        # Create settlement
        settlement = Settlement(
            vendor_id=vendor_id,
            period_start=start_date,
            period_end=end_date,
            total_orders=total_orders,
            gross_amount=gross_amount,
            commission_amount=commission_amount,
            delivery_charges=delivery_charges,
            refund_amount=refund_amount,
            net_amount=net_amount,
            status="pending",
            order_ids=order_ids_list,
        )

        self.db.add(settlement)
        await self.db.flush()
        return settlement

    async def complete_settlement(self, settlement_id: UUID, processed_by: UUID) -> bool:
        """Mark settlement as completed and update vendor wallet balances."""
        res = await self.db.execute(
            select(Settlement).where(Settlement.id == settlement_id)
        )
        settlement = res.scalars().first()
        if not settlement or settlement.status == "completed":
            return False

        settlement.status = "completed"
        settlement.processed_at = datetime.now(timezone.utc)
        settlement.processed_by = processed_by

        # Release/adjust vendor wallets
        vw_res = await self.db.execute(
            select(VendorWallet).where(VendorWallet.vendor_id == settlement.vendor_id)
        )
        vw = vw_res.scalars().first()
        if vw:
            # Transfer from pending or straight credit
            # Here we reflect settlement by incrementing total earned
            vw.total_withdrawn = float(vw.total_withdrawn) + float(settlement.net_amount)
            vw.balance = max(0.0, float(vw.balance) - float(settlement.net_amount))

        await self.db.flush()
        return True
