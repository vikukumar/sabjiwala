"""
Order placement and lifecycle management service.
"""
import random
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, OrderStatus, OrderStatusHistory, Cart, CartItem
from app.models.product import Product, ProductPrice, Inventory, InventoryLog
from app.models.vendor import Vendor, VendorDeliveryRule, VendorWallet
from app.models.user import User, UserAddress
from app.models.payment import PaymentStatus, PaymentGateway, WalletTransactionType
from app.services.coupon_engine import CouponEngine
from app.services.map_service import MapService
from app.services.payment_service import PaymentService
from app.services.notification_service import NotificationService


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.map_service = MapService()
        self.payment_service = PaymentService(db)
        self.notification_service = NotificationService(db)

    def _generate_order_number(self) -> str:
        """Generate a unique order number like SW-20260529-XXXX."""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rand_digits = "".join(str(random.randint(0, 9)) for _ in range(5))
        return f"SW-{date_str}-{rand_digits}"

    async def calculate_delivery_charges(
        self,
        vendor_id: UUID,
        address: UserAddress
    ) -> Tuple[float, float]:
        """
        Calculate distance and delivery charges from vendor store to customer address.
        """
        # Fetch vendor profile and store
        vendor_result = await self.db.execute(
            select(Vendor).options(selectinload(Vendor.store)).where(Vendor.id == vendor_id)
        )
        vendor = vendor_result.scalars().first()
        if not vendor or not vendor.store:
            return 0.0, 0.0

        # Fetch delivery rules
        rules_result = await self.db.execute(
            select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor_id)
        )
        rule = rules_result.scalars().first()
        if not rule:
            # Default fallback rule
            rule = VendorDeliveryRule(
                base_delivery_charge=30.0,
                per_km_charge=5.0,
                max_delivery_distance_km=12.0
            )

        if not address.latitude or not address.longitude or not vendor.store.latitude or not vendor.store.longitude:
            # Return defaults if coords are missing
            return float(rule.base_delivery_charge), 0.0

        distance = self.map_service.calculate_haversine_distance(
            vendor.store.latitude, vendor.store.longitude,
            address.latitude, address.longitude
        )

        if distance > rule.max_delivery_distance_km:
            raise ValueError(f"Delivery distance exceeds vendor's limit of {rule.max_delivery_distance_km} km")

        delivery_charge = float(rule.base_delivery_charge) + float(rule.per_km_charge) * distance
        return delivery_charge, distance

    async def place_order(
        self,
        user_id: UUID,
        vendor_id: UUID,
        address_id: UUID,
        payment_method: str,
        coupon_code: Optional[str] = None,
        use_wallet: bool = False,
        customer_notes: Optional[str] = None
    ) -> Tuple[Order, Dict[str, Any]]:
        """
        Perform checkout and place an order for a specific vendor's cart.
        """
        # Fetch Address
        addr_result = await self.db.execute(
            select(UserAddress).where(UserAddress.id == address_id, UserAddress.user_id == user_id, UserAddress.is_deleted == False)
        )
        address = addr_result.scalars().first()
        if not address:
            raise ValueError("Delivery address not found")

        # Fetch Cart
        cart_result = await self.db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.user_id == user_id, Cart.vendor_id == vendor_id, Cart.is_deleted == False)
        )
        cart = cart_result.scalars().first()
        if not cart or not cart.items:
            raise ValueError("Shopping cart is empty")

        # 1. Verify inventory & collect details
        cart_items_to_process = []
        subtotal = 0.0
        for item in cart.items:
            if item.is_deleted:
                continue

            # Fetch product details
            prod_result = await self.db.execute(
                select(Product).where(Product.id == item.product_id, Product.is_deleted == False)
            )
            product = prod_result.scalars().first()
            if not product:
                raise ValueError(f"Product '{item.product_id}' is no longer available")

            # Check inventory
            inv_result = await self.db.execute(
                select(Inventory).where(
                    Inventory.product_id == item.product_id,
                    Inventory.vendor_id == vendor_id,
                    Inventory.is_deleted == False
                )
            )
            inventory = inv_result.scalars().first()
            if not inventory or (not inventory.is_unlimited and inventory.quantity < item.quantity):
                raise ValueError(f"Product '{product.name}' has insufficient stock")

            # Calculate secure 4.5% markup over base vendor catalog price
            from app.models.product import ProductPrice
            price_res = await self.db.execute(
                select(ProductPrice).where(
                    ProductPrice.product_id == item.product_id,
                    ProductPrice.vendor_id == vendor_id,
                    ProductPrice.is_active == True
                )
            )
            prod_price = price_res.scalars().first()
            base_catalog_price = float(prod_price.price) if prod_price else float(item.unit_price)
            
            # Application-wide dynamic 4.5% markup
            marked_up_price = round(base_catalog_price * 1.045, 2)
            item.unit_price = marked_up_price

            item_subtotal = marked_up_price * item.quantity
            subtotal += item_subtotal
            cart_items_to_process.append((item, product, inventory))

        # 2. Calculate charges
        delivery_charge, distance_km = await self.calculate_delivery_charges(vendor_id, address)

        # Apply vendor delivery rule minima and custom packaging fee
        rules_result = await self.db.execute(
            select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor_id)
        )
        rule = rules_result.scalars().first()
        packaging_charge = 0.0
        if rule:
            if subtotal < float(rule.min_order_amount):
                raise ValueError(f"Minimum order amount for this vendor is Rs. {rule.min_order_amount}")
            if rule.free_delivery_above is not None and subtotal >= float(rule.free_delivery_above):
                delivery_charge = 0.0
            if hasattr(rule, "packaging_fee") and rule.packaging_fee is not None:
                packaging_charge = float(rule.packaging_fee)

        # If packaging_charge is 0.0, fallback to global platform handling fee
        if packaging_charge == 0.0:
            from app.models.system import SystemSetting
            setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "platform_handling_fee")
            )
            setting = setting_res.scalars().first()
            if setting and setting.value:
                try:
                    packaging_charge = float(setting.value)
                except ValueError:
                    packaging_charge = 5.0
            else:
                packaging_charge = 5.0

        # Tax calculation (standard 5%)
        tax_amount = subtotal * 0.05

        # 3. Apply coupon if any
        coupon_discount = 0.0
        coupon_id = None
        applied_coupon_code = coupon_code or cart.coupon_code
        if applied_coupon_code:
            coupon_engine = CouponEngine(self.db)
            validation = await coupon_engine.validate_coupon(
                applied_coupon_code, user_id, vendor_id, payment_method
            )
            if validation["valid"]:
                coupon_discount = float(validation["discount"])
                coupon_id = validation["coupon_id"]
                
                # If coupon is free delivery
                if validation.get("coupon_type") == "free_delivery":
                    delivery_charge = 0.0
            else:
                raise ValueError(f"Coupon validation failed: {validation['message']}")

        # 4. Wallet deduction
        wallet_amount = 0.0
        if use_wallet:
            wallet = await self.payment_service.get_or_create_wallet(user_id)
            wallet_balance = float(wallet.balance)
            total_before_wallet = subtotal + delivery_charge + tax_amount + packaging_charge - coupon_discount
            wallet_amount = min(wallet_balance, total_before_wallet)

        total_amount = subtotal + delivery_charge + tax_amount + packaging_charge - coupon_discount - wallet_amount

        # 5. Create Order
        delivery_address_dict = {
            "label": address.label,
            "full_name": address.full_name,
            "phone": address.phone,
            "address_line_1": address.address_line_1,
            "address_line_2": address.address_line_2,
            "city": address.city,
            "state": address.state,
            "country": address.country,
            "postal_code": address.postal_code,
            "formatted_address": address.formatted_address,
        }

        order = Order(
            order_number=self._generate_order_number(),
            user_id=user_id,
            vendor_id=vendor_id,
            status=OrderStatus.PENDING,
            delivery_address=delivery_address_dict,
            delivery_latitude=address.latitude,
            delivery_longitude=address.longitude,
            subtotal=subtotal,
            delivery_charge=delivery_charge,
            tax_amount=tax_amount,
            discount_amount=coupon_discount,
            coupon_discount=coupon_discount,
            wallet_amount=wallet_amount,
            total_amount=total_amount,
            packaging_charge=packaging_charge,
            coupon_id=coupon_id,
            coupon_code=applied_coupon_code,
            payment_method=payment_method,
            payment_status="pending" if payment_method != "cod" else "unpaid",
            delivery_distance_km=distance_km,
            customer_notes=customer_notes,
            delivery_otp=f"{random.randint(1000, 9999)}",
        )
        self.db.add(order)
        await self.db.flush()

        # 6. Create Order Items & Deduct Inventory
        for item, product, inventory in cart_items_to_process:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                vendor_id=vendor_id,
                product_name=product.name,
                unit=product.unit,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=float(item.unit_price) * item.quantity,
            )
            self.db.add(order_item)

            # Deduct inventory
            if not inventory.is_unlimited:
                old_qty = inventory.quantity
                inventory.quantity -= item.quantity
                inventory.is_in_stock = inventory.quantity > 0

                # Audit log for inventory
                inv_log = InventoryLog(
                    inventory_id=inventory.id,
                    vendor_id=vendor_id,
                    change_type="remove",
                    quantity_change=item.quantity,
                    quantity_before=old_qty,
                    quantity_after=inventory.quantity,
                    reference_type="order",
                    reference_id=str(order.id),
                    created_by=user_id,
                )
                self.db.add(inv_log)

        # 7. Record status history
        history = OrderStatusHistory(
            order_id=order.id,
            from_status=None,
            to_status=OrderStatus.PENDING.value,
            changed_by=user_id,
            changed_by_type="customer",
            notes="Order placed by customer",
        )
        self.db.add(history)

        # 8. Increment coupon uses if applied
        if coupon_id:
            from app.models.coupon import CouponUsage
            usage = CouponUsage(
                coupon_id=coupon_id,
                user_id=user_id,
                order_id=order.id,
                discount_applied=coupon_discount,
            )
            self.db.add(usage)
            await self.db.execute(
                update(Coupon).where(Coupon.id == coupon_id).values(current_uses=Coupon.current_uses + 1)
            )

        # 9. Clear Cart
        for item, _, _ in cart_items_to_process:
            item.soft_delete(user_id)
        cart.coupon_code = None
        cart.soft_delete(user_id)

        # 10. Process wallet deduction if any
        if wallet_amount > 0:
            success, txn = await self.payment_service.debit_wallet(
                user_id=user_id,
                amount=wallet_amount,
                txn_type=WalletTransactionType.DEBIT,
                reference_type="order",
                reference_id=str(order.id),
                description=f"Wallet discount applied to order {order.order_number}"
            )
            if not success:
                raise ValueError("Wallet transaction failed")

        # 11. Initiate payment gateway transaction
        payment_gateway = PaymentGateway(payment_method)
        pay_info = {}
        if total_amount > 0:
            pay_info = await self.payment_service.initiate_payment(
                order.id, user_id, total_amount, payment_gateway
            )
        else:
            # Order is fully paid by wallet/coupon
            order.payment_status = "paid"
            order.status = OrderStatus.CONFIRMED
            try:
                from app.services.delivery_assignment_service import DeliveryAssignmentService
                das = DeliveryAssignmentService(self.db)
                await das.assign_delivery(order.id)
            except Exception as e:
                logger.error("Failed to automatically assign delivery boy on place_order", order_id=str(order.id), error=str(e))
            # Create dummy completed payment transaction for tracking
            from app.models.payment import Payment
            pay = Payment(
                order_id=order.id,
                user_id=user_id,
                gateway=payment_gateway,
                status=PaymentStatus.COMPLETED,
                amount=0.0,
                completed_at=datetime.now(timezone.utc),
            )
            self.db.add(pay)
            await self.db.flush()
            pay_info = {"success": True, "message": "Fully paid via wallet/coupon"}

        await self.db.flush()

        # Trigger notification
        await self.notification_service.dispatch(
            event_key="order_placed",
            user_id=user_id,
            variables={"order_number": order.order_number, "total_amount": float(order.total_amount)},
            reference_type="order",
            reference_id=str(order.id)
        )

        return order, pay_info

    async def update_order_status(
        self,
        order_id: UUID,
        status: OrderStatus,
        changed_by: UUID,
        user_type: str,
        notes: Optional[str] = None
    ) -> Order:
        """
        Transition order state and execute business triggers.
        """
        result = await self.db.execute(
            select(Order).where(Order.id == order_id, Order.is_deleted == False)
        )
        order = result.scalars().first()
        if not order:
            raise ValueError("Order not found")

        old_status = order.status
        if old_status == status:
            return order

        # State transition validations
        # e.g., cannot cancel a delivered order
        if old_status in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
            raise ValueError(f"Cannot change status of {old_status.value} order")

        # Update order status
        order.status = status
        
        # Audit history
        history = OrderStatusHistory(
            order_id=order.id,
            from_status=old_status.value,
            to_status=status.value,
            changed_by=changed_by,
            changed_by_type=user_type,
            notes=notes,
        )
        self.db.add(history)

        # Trigger actions based on new status
        if status == OrderStatus.CANCELLED:
            order.cancelled_at = datetime.now(timezone.utc)
            order.cancelled_by = changed_by
            order.cancellation_reason = notes
            
            # Restore inventory stock
            items_result = await self.db.execute(
                select(OrderItem).where(OrderItem.order_id == order_id)
            )
            for item in items_result.scalars().all():
                inv_result = await self.db.execute(
                    select(Inventory).where(
                        Inventory.product_id == item.product_id,
                        Inventory.vendor_id == order.vendor_id
                    )
                )
                inventory = inv_result.scalars().first()
                if inventory and not inventory.is_unlimited:
                    old_qty = inventory.quantity
                    inventory.quantity += item.quantity
                    inventory.is_in_stock = True
                    
                    inv_log = InventoryLog(
                        inventory_id=inventory.id,
                        vendor_id=order.vendor_id,
                        change_type="add",
                        quantity_change=item.quantity,
                        quantity_before=old_qty,
                        quantity_after=inventory.quantity,
                        reference_type="cancellation",
                        reference_id=str(order.id),
                        created_by=changed_by,
                    )
                    self.db.add(inv_log)

            # Refund wallet portion if any
            if float(order.wallet_amount) > 0:
                await self.payment_service.credit_wallet(
                    user_id=order.user_id,
                    amount=float(order.wallet_amount),
                    txn_type=WalletTransactionType.REFUND,
                    reference_type="order",
                    reference_id=str(order.id),
                    description=f"Refund for cancelled order {order.order_number}"
                )

        elif status in [OrderStatus.CONFIRMED, OrderStatus.PACKED]:
            if not order.delivery_boy_id:
                try:
                    from app.services.delivery_assignment_service import DeliveryAssignmentService
                    das = DeliveryAssignmentService(self.db)
                    await das.assign_delivery(order.id)
                except Exception as e:
                    logger.error("Failed to automatically assign delivery boy on status update", order_id=str(order.id), error=str(e))

        elif status == OrderStatus.DELIVERED:
            order.actual_delivery_time = datetime.now(timezone.utc)
            order.payment_status = "paid"  # Delivered COD becomes paid

            # 1. Calculate base catalog subtotal (before the 4.5% markup)
            base_catalog_subtotal = round(float(order.subtotal) / 1.045, 2)

            # 2. Check if a private or public courier was assigned
            is_public_courier = True
            delivery_boy = None
            
            if order.delivery_boy_id:
                from app.models.delivery import DeliveryBoy, DeliveryWallet
                boy_res = await self.db.execute(
                    select(DeliveryBoy).where(DeliveryBoy.user_id == order.delivery_boy_id)
                )
                delivery_boy = boy_res.scalars().first()
                if delivery_boy and delivery_boy.vendor_id is not None:
                    is_public_courier = False

            # 3. Credit delivery boy wallet strictly if they are a public platform agent
            if delivery_boy and is_public_courier:
                # Dynamic delivery payout: distance * rate_per_km
                from app.models.system import SystemSetting
                setting_res = await self.db.execute(
                    select(SystemSetting).where(SystemSetting.key == "delivery_boy_rate_per_km")
                )
                setting = setting_res.scalars().first()
                rate_per_km = float(setting.value) if setting else 10.0
                
                distance_km = float(order.delivery_distance_km or 0.0)
                delivery_payout = round(distance_km * rate_per_km, 2)
                
                dw_res = await self.db.execute(
                    select(DeliveryWallet).where(DeliveryWallet.delivery_boy_id == delivery_boy.id)
                )
                dw = dw_res.scalars().first()
                if not dw:
                    dw = DeliveryWallet(delivery_boy_id=delivery_boy.id, balance=0.0, pending_balance=0.0)
                    self.db.add(dw)
                    await self.db.flush()
                dw.balance = float(dw.balance) + delivery_payout
                dw.total_earned = float(dw.total_earned) + delivery_payout

            # 4. Settle vendor wallet with base catalog rates
            vendor_res = await self.db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
            vendor = vendor_res.scalars().first()
            commission_rate = vendor.commission_rate if vendor else 0.05
            commission = base_catalog_subtotal * commission_rate
            
            net_earnings = base_catalog_subtotal - commission
            
            # Deduct delivery boy charges strictly if a public courier was used
            if is_public_courier:
                net_earnings = net_earnings - float(order.delivery_charge or 0.0)

            # Credit Vendor wallet
            vw_result = await self.db.execute(
                select(VendorWallet).where(VendorWallet.vendor_id == order.vendor_id)
            )
            vw = vw_result.scalars().first()
            if not vw:
                vw = VendorWallet(vendor_id=order.vendor_id, balance=0.0, pending_balance=0.0)
                self.db.add(vw)
                await self.db.flush()
            vw.balance = float(vw.balance) + net_earnings
            vw.total_earned = float(vw.total_earned) + net_earnings

        await self.db.flush()

        # Send notifications
        await self.notification_service.dispatch(
            event_key=f"order_{status.value}",
            user_id=order.user_id,
            variables={"order_number": order.order_number},
            reference_type="order",
            reference_id=str(order.id)
        )

        return order
