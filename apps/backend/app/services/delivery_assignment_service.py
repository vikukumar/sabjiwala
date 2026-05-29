"""
Delivery Assignment Service to match orders with optimal nearby delivery boys.
"""
import structlog
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.delivery import DeliveryBoy, DeliveryBoyStatus, AvailabilityStatus
from app.models.order import Order, OrderStatus, OrderStatusHistory
from app.models.vendor import Vendor
from app.services.map_service import MapService

logger = structlog.get_logger()


class DeliveryAssignmentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.map_service = MapService()

    async def find_best_delivery_boy(self, order_id: UUID) -> Optional[DeliveryBoy]:
        """
        Find closest available delivery boy who is under their concurrent order limit.
        """
        # Fetch order with vendor store coordinates
        order_res = await self.db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = order_res.scalars().first()
        if not order:
            logger.warning("Order not found for delivery assignment", order_id=str(order_id))
            return None

        vendor_res = await self.db.execute(
            select(Vendor).options(selectinload(Vendor.store)).where(Vendor.id == order.vendor_id)
        )
        vendor = vendor_res.scalars().first()
        if not vendor or not vendor.store or not vendor.store.latitude or not vendor.store.longitude:
            logger.warning("Vendor or vendor store location not found for assignment", vendor_id=str(order.vendor_id))
            return None

        # Fetch active, available delivery boys
        # Delivery boy must not exceed max concurrent orders
        boys_res = await self.db.execute(
            select(DeliveryBoy)
            .where(
                DeliveryBoy.status == DeliveryBoyStatus.ACTIVE,
                DeliveryBoy.availability.in_([AvailabilityStatus.AVAILABLE, AvailabilityStatus.ON_DELIVERY]),
                DeliveryBoy.current_order_count < DeliveryBoy.max_concurrent_orders,
                DeliveryBoy.is_deleted == False
            )
        )
        candidates = boys_res.scalars().all()

        if not candidates:
            logger.info("No delivery boys available for assignment", order_id=str(order_id))
            return None

        # Calculate distance to vendor store and sort candidates
        scored_candidates: List[Tuple[float, DeliveryBoy]] = []
        for boy in candidates:
            if boy.current_latitude is None or boy.current_longitude is None:
                # If location is unknown, treat as very far
                distance = 999.0
            else:
                distance = self.map_service.calculate_haversine_distance(
                    vendor.store.latitude, vendor.store.longitude,
                    boy.current_latitude, boy.current_longitude
                )
            
            # Penalize slightly based on active workload
            score = distance + (boy.current_order_count * 1.5)
            scored_candidates.append((score, boy))

        # Sort by score ascending
        scored_candidates.sort(key=lambda x: x[0])
        best_boy = scored_candidates[0][1]
        return best_boy

    async def assign_delivery(self, order_id: UUID) -> bool:
        """
        Match order to delivery boy, perform database updates, and record status history.
        """
        boy = await self.find_best_delivery_boy(order_id)
        if not boy:
            return False

        # Assign
        await self.db.execute(
            update(Order)
            .where(Order.id == order_id)
            .values(
                delivery_boy_id=boy.user_id,
                status=OrderStatus.ASSIGNED,
            )
        )

        # Update delivery boy load
        boy.current_order_count += 1
        boy.availability = AvailabilityStatus.ON_DELIVERY

        # Record history
        history = OrderStatusHistory(
            order_id=order_id,
            from_status=OrderStatus.PENDING.value,
            to_status=OrderStatus.ASSIGNED.value,
            changed_by=None,
            changed_by_type="system",
            notes=f"Automatically assigned delivery personnel (ID: {boy.user_id})",
        )
        self.db.add(history)
        await self.db.flush()

        logger.info("Order successfully assigned to delivery boy", order_id=str(order_id), delivery_boy=str(boy.user_id))

        # Dispatch push notification to delivery boy
        try:
            from app.services.notification_service import NotificationService
            notif = NotificationService(self.db)
            await notif.dispatch(
                event_key="delivery_assigned",
                user_id=boy.user_id,
                variables={"order_id": str(order_id)},
                reference_type="order",
                reference_id=str(order_id)
            )
        except Exception as e:
            logger.debug("Failed to dispatch delivery assignment notification", error=str(e))

        return True
