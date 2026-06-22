import structlog
import random

logger = structlog.get_logger()
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
                base_delivery_charge=0.0,
                per_km_charge=2.0,
                max_delivery_distance_km=25.0
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

        # Hardcode as requested by user
        delivery_charge = 0.0 + 2.0 * distance
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
        original_delivery_charge = delivery_charge

        # Apply vendor delivery rule minima and custom packaging fee
        rules_result = await self.db.execute(
            select(VendorDeliveryRule).where(VendorDeliveryRule.vendor_id == vendor_id)
        )
        rule = rules_result.scalars().first()
        
        base_packaging = 0.0
        if rule and rule.packaging_fee is not None:
            base_packaging = float(rule.packaging_fee)
            
        if base_packaging == 0.0:
            from app.models.system import SystemSetting
            setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "platform_handling_fee")
            )
            setting = setting_res.scalars().first()
            if setting and setting.value:
                try:
                    base_packaging = float(setting.value)
                except ValueError:
                    base_packaging = 5.0
            else:
                base_packaging = 5.0
                
        packaging_charge = base_packaging

        # Platform Fee
        platform_fee = 0.0
        if rule and rule.platform_fee is not None:
            platform_fee = float(rule.platform_fee)
        else:
            from app.models.system import SystemSetting
            setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "default_platform_fee")
            )
            setting = setting_res.scalars().first()
            platform_fee = float(setting.value) if (setting and setting.value) else 0.0

        # Convenience Fee
        convenience_fee = 0.0
        if rule and rule.convenience_fee is not None:
            convenience_fee = float(rule.convenience_fee)
        else:
            from app.models.system import SystemSetting
            setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "default_convenience_fee")
            )
            setting = setting_res.scalars().first()
            convenience_fee = float(setting.value) if (setting and setting.value) else 0.0
        
        # Precedence: Vendor limit > Admin limit > Default 0.0
        free_delivery_limit = 0.0
        if rule and rule.free_delivery_above is not None:
            free_delivery_limit = float(rule.free_delivery_above)
        else:
            from app.models.system import SystemSetting
            admin_setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "free_delivery_above")
            )
            admin_setting = admin_setting_res.scalars().first()
            if admin_setting and admin_setting.value:
                try:
                    free_delivery_limit = float(admin_setting.value)
                except ValueError:
                    pass

        if rule:
            if subtotal < float(rule.min_order_amount):
                raise ValueError(f"Minimum order amount for this vendor is ₹{rule.min_order_amount}")
        
        if free_delivery_limit > 0 and subtotal >= free_delivery_limit:
            delivery_charge = 0.0
                
        # Apply platform fee exemptions
        exempt_packaging = False
        if rule and rule.free_platform_fee_above is not None:
            if subtotal >= float(rule.free_platform_fee_above):
                exempt_packaging = True
        else:
            from app.models.system import SystemSetting
            admin_setting_res = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == "free_platform_fee_above")
            )
            admin_setting = admin_setting_res.scalars().first()
            if admin_setting and admin_setting.value:
                try:
                    if subtotal >= float(admin_setting.value):
                        exempt_packaging = True
                except ValueError:
                    pass
                    
        if exempt_packaging:
            packaging_charge = 0.0
            platform_fee = 0.0

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

        # Round individual components first
        subtotal = round(subtotal, 2)
        delivery_charge = round(delivery_charge, 2)
        packaging_charge = round(packaging_charge, 2)
        platform_fee = round(platform_fee, 2)
        convenience_fee = round(convenience_fee, 2)
        coupon_discount = round(coupon_discount, 2)

        # Tax calculation (standard 5% applied to everything after discount)
        taxable_amount = max(0.0, subtotal + delivery_charge + packaging_charge + platform_fee + convenience_fee - coupon_discount)
        tax_amount = round(taxable_amount * 0.05, 2)

        # 4. Wallet deduction
        wallet_amount = 0.0
        if use_wallet:
            wallet = await self.payment_service.get_or_create_wallet(user_id)
            wallet_balance = float(wallet.balance)
            total_before_wallet = round(subtotal + delivery_charge + tax_amount + packaging_charge + platform_fee + convenience_fee - coupon_discount, 2)
            wallet_amount = round(min(wallet_balance, total_before_wallet), 2)

        total_amount = round(subtotal + delivery_charge + tax_amount + packaging_charge + platform_fee + convenience_fee - coupon_discount - wallet_amount, 2)

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
            status=OrderStatus.PENDING if payment_method != "cod" else OrderStatus.CONFIRMED,
            delivery_address=delivery_address_dict,
            delivery_latitude=address.latitude,
            delivery_longitude=address.longitude,
            subtotal=subtotal,
            original_delivery_charge=original_delivery_charge,
            delivery_charge=delivery_charge,
            platform_fee=platform_fee,
            convenience_fee=convenience_fee,
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
                product_image_url=product.primary_image_url,
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
            from app.models.coupon import Coupon, CouponUsage
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
            # Cash on Delivery orders are confirmed immediately
            if payment_method == "cod":
                order.status = OrderStatus.CONFIRMED
        else:
            # Order is fully paid by wallet/coupon, status is confirmed
            order.payment_status = "paid"
            order.status = OrderStatus.CONFIRMED
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

        # Broadcast WebSocket event to Customer and Vendor
        try:
            from app.websocket.manager import ws_manager
            vendor_res = await self.db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
            vendor = vendor_res.scalars().first()
            vendor_user_id = vendor.user_id if vendor else None

            ws_payload = {
                "type": "order_status_update",
                "data": {
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                    "status": order.status.value,
                    "delivery_boy_id": str(order.delivery_boy_id) if order.delivery_boy_id else None,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
            await ws_manager.send_to_user(order.user_id, ws_payload)
            if vendor_user_id:
                await ws_manager.send_to_user(vendor_user_id, ws_payload)
        except Exception as ws_err:
            logger.error("Failed to broadcast WebSocket placement status", order_id=str(order.id), error=str(ws_err))

        # Trigger customer notification
        await self.notification_service.dispatch(
            event_key="order_placed",
            user_id=user_id,
            variables={"order_number": order.order_number, "total_amount": float(order.total_amount)},
            reference_type="order",
            reference_id=str(order.id)
        )

        # Trigger vendor in-app notification for new order
        if vendor_user_id:
            try:
                await self.notification_service.dispatch(
                    event_key="order_new_for_vendor",
                    user_id=vendor_user_id,
                    variables={"order_number": order.order_number, "total_amount": float(order.total_amount)},
                    reference_type="order",
                    reference_id=str(order.id)
                )
            except Exception as notif_err:
                logger.warning("Failed to send vendor new-order notification", error=str(notif_err))

        return order, pay_info

    async def update_order_status(
        self,
        order_id: UUID,
        status: OrderStatus,
        changed_by: UUID,
        user_type: str,
        notes: Optional[str] = None,
        delivery_option: Optional[str] = None,
        otp: Optional[str] = None,
        images: Optional[List[str]] = None
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

        if status == OrderStatus.CANCELLED:
            if old_status in [OrderStatus.PICKED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED]:
                raise ValueError("Order has already been shipped and cannot be cancelled.")

        if delivery_option:
            meta = dict(order.metadata_json) if order.metadata_json else {}
            meta["delivery_option"] = delivery_option
            order.metadata_json = meta

        if status == OrderStatus.DELIVERED:
            if not otp:
                raise ValueError("OTP is required to deliver the order")
            if not images or len(images) < 2:
                raise ValueError("Minimum 2 verification photos are required to deliver the order")
            if order.delivery_otp != otp:
                raise ValueError("Invalid OTP code. Delivery validation failed.")
            
            meta = dict(order.metadata_json) if order.metadata_json else {}
            meta["delivery_proof_images"] = images
            order.metadata_json = meta

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

        # Trigger auto assignment if accepting with auto option
        if status == OrderStatus.ACCEPTED and delivery_option == "auto":
            from app.services.delivery_assignment_service import DeliveryAssignmentService
            assign_service = DeliveryAssignmentService(self.db)
            await assign_service.assign_delivery(order.id)
            # Reload order to capture the assigned delivery_boy_id set by assign_delivery
            await self.db.refresh(order)

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
            # Skipped automatic delivery boy assignment as direct vendor delivery flow is active
            pass

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
            else:
                is_public_courier = False

            # 3. Credit delivery boy wallet strictly if they are a public platform agent
            if delivery_boy and is_public_courier:
                # Dynamic delivery payout: distance * rate_per_km
                from app.models.system import SystemSetting
                setting_res = await self.db.execute(
                    select(SystemSetting).where(SystemSetting.key == "delivery_boy_rate_per_km")
                )
                setting = setting_res.scalars().first()
                rate_per_km = 10.0
                if setting and setting.value is not None:
                    try:
                        rate_per_km = float(setting.value)
                    except ValueError:
                        pass
                
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
            
            if order.payment_method and order.payment_method.lower() == "cod":
                # For COD orders, the vendor collects cash directly, so virtual wallet balance is not credited.
                # However, the order is still recorded in their total lifetime earnings.
                vw.total_earned = float(vw.total_earned) + net_earnings
            else:
                vw.balance = float(vw.balance) + net_earnings
                vw.total_earned = float(vw.total_earned) + net_earnings

        await self.db.flush()

        # Broadcast WebSocket event to Customer, Vendor, and Delivery Boy
        try:
            from app.websocket.manager import ws_manager
            vendor_res = await self.db.execute(select(Vendor).where(Vendor.id == order.vendor_id))
            vendor = vendor_res.scalars().first()
            vendor_user_id = vendor.user_id if vendor else None

            ws_payload = {
                "type": "order_status_update",
                "data": {
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                    "status": status.value,
                    "old_status": old_status.value if old_status else None,
                    "delivery_boy_id": str(order.delivery_boy_id) if order.delivery_boy_id else None,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
            # Send to customer
            await ws_manager.send_to_user(order.user_id, ws_payload)
            # Send to vendor
            if vendor_user_id:
                await ws_manager.send_to_user(vendor_user_id, ws_payload)
            # Send to delivery boy if assigned
            if order.delivery_boy_id:
                await ws_manager.send_to_user(order.delivery_boy_id, ws_payload)
        except Exception as ws_err:
            logger.error("Failed to broadcast WebSocket status update", order_id=str(order.id), error=str(ws_err))

        # Send notifications
        await self.notification_service.dispatch(
            event_key=f"order_{status.value}",
            user_id=order.user_id,
            variables={"order_number": order.order_number},
            reference_type="order",
            reference_id=str(order.id)
        )

        return order
