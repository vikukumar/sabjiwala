"""
Payment integration and Wallet management service.
Cashfree is used for online payments if CASHFREE_APP_ID + CASHFREE_SECRET_KEY are set.
Otherwise only COD and Wallet are available.
"""
import hmac
import hashlib
import json
import secrets
import structlog
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.payment import (
    Payment, PaymentStatus, PaymentGateway, Wallet, WalletType,
    WalletTransaction, WalletTransactionType, RazorpayOrder, PhonepeTransaction
)
from app.models.order import Order, OrderStatus

logger = structlog.get_logger()


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_wallet(self, user_id: UUID, wallet_type: WalletType = WalletType.CUSTOMER) -> Wallet:
        """Get user's wallet or create one if it doesn't exist."""
        result = await self.db.execute(
            select(Wallet).where(Wallet.user_id == user_id, Wallet.is_deleted == False)
        )
        wallet = result.scalars().first()
        if not wallet:
            wallet = Wallet(
                user_id=user_id,
                wallet_type=wallet_type,
                balance=0.0,
                pending_balance=0.0,
                total_credited=0.0,
                total_debited=0.0,
            )
            self.db.add(wallet)
            await self.db.flush()
        return wallet

    async def credit_wallet(
        self,
        user_id: UUID,
        amount: float,
        txn_type: WalletTransactionType,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        wallet_type: WalletType = WalletType.CUSTOMER
    ) -> WalletTransaction:
        """Credit amount to user's wallet."""
        wallet = await self.get_or_create_wallet(user_id, wallet_type)
        
        balance_before = float(wallet.balance)
        wallet.balance = float(wallet.balance) + amount
        wallet.total_credited = float(wallet.total_credited) + amount
        balance_after = float(wallet.balance)

        txn = WalletTransaction(
            wallet_id=wallet.id,
            user_id=user_id,
            transaction_type=txn_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
        )
        self.db.add(txn)
        await self.db.flush()
        return txn

    async def debit_wallet(
        self,
        user_id: UUID,
        amount: float,
        txn_type: WalletTransactionType,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        description: Optional[str] = None,
        wallet_type: WalletType = WalletType.CUSTOMER
    ) -> Tuple[bool, Optional[WalletTransaction]]:
        """Debit amount from user's wallet if sufficient balance exists."""
        wallet = await self.get_or_create_wallet(user_id, wallet_type)
        
        if float(wallet.balance) < amount:
            return False, None

        balance_before = float(wallet.balance)
        wallet.balance = float(wallet.balance) - amount
        wallet.total_debited = float(wallet.total_debited) + amount
        balance_after = float(wallet.balance)

        txn = WalletTransaction(
            wallet_id=wallet.id,
            user_id=user_id,
            transaction_type=txn_type,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
        )
        self.db.add(txn)
        await self.db.flush()
        return True, txn

    async def initiate_payment(
        self,
        order_id: Optional[UUID],
        user_id: UUID,
        amount: float,
        gateway: PaymentGateway
    ) -> Dict[str, Any]:
        """
        Create a Payment record and generate gateway transactions (Razorpay order ID / PhonePe URL).
        """
        payment = Payment(
            order_id=order_id,
            user_id=user_id,
            gateway=gateway,
            status=PaymentStatus.PENDING,
            amount=amount,
            currency="INR",
        )
        self.db.add(payment)
        await self.db.flush()

        if gateway == PaymentGateway.COD:
            payment.payment_method = "cod"
            return {"payment_id": str(payment.id), "gateway": "cod", "message": "Cash on Delivery initiated"}

        elif gateway == PaymentGateway.WALLET:
            # Try to debit wallet
            success, txn = await self.debit_wallet(
                user_id=user_id,
                amount=amount,
                txn_type=WalletTransactionType.DEBIT,
                reference_type="order",
                reference_id=str(order_id) if order_id else None,
                description=f"Payment for Order ID {order_id}" if order_id else "Wallet payment"
            )
            if not success:
                payment.status = PaymentStatus.FAILED
                payment.error_message = "Insufficient wallet balance"
                await self.db.flush()
                return {"payment_id": str(payment.id), "success": False, "error": "Insufficient wallet balance"}

            payment.status = PaymentStatus.COMPLETED
            payment.payment_method = "wallet"
            payment.completed_at = datetime.now(timezone.utc)
            await self.db.flush()
            return {"payment_id": str(payment.id), "success": True, "wallet_transaction_id": str(txn.id)}

        elif gateway == PaymentGateway.RAZORPAY:
            # Razorpay integration
            amount_paise = int(amount * 100)
            receipt = f"rec_{order_id.hex[:14]}" if order_id else f"top_{secrets.token_hex(6)}"
            
            # Mock or actual Razorpay client call
            gateway_order_id = f"order_{secrets.token_hex(8)}" # Fallback mock ID
            
            if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
                try:
                    import razorpay
                    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                    rp_order = client.order.create({
                        "amount": amount_paise,
                        "currency": "INR",
                        "receipt": receipt,
                        "notes": {"order_id": str(order_id) if order_id else "", "payment_id": str(payment.id)}
                    })
                    gateway_order_id = rp_order["id"]
                except Exception as e:
                    logger.error("Razorpay client order creation failed", error=str(e))

            payment.gateway_order_id = gateway_order_id
            
            # Store Razorpay order detail
            rp_order_record = RazorpayOrder(
                payment_id=payment.id,
                razorpay_order_id=gateway_order_id,
                amount=amount_paise,
                receipt=receipt,
            )
            self.db.add(rp_order_record)
            await self.db.flush()

            return {
                "payment_id": str(payment.id),
                "gateway": "razorpay",
                "razorpay_order_id": gateway_order_id,
                "amount": amount,
                "currency": "INR",
                "key_id": settings.RAZORPAY_KEY_ID,
            }

        elif gateway == PaymentGateway.PHONEPE:
            import base64
            import httpx
            
            amount_paise = int(amount * 100)
            merchant_txn_id = f"TXN_{secrets.token_hex(8).upper()}"
            payment.gateway_order_id = merchant_txn_id
            
            redirect_url = f"{settings.APP_URL}/payment/callback?txnId={merchant_txn_id}"
            callback_url = f"{settings.APP_URL}/api/v1/payments/webhook/phonepe"

            # 1. Base64 payload
            payload = {
                "merchantId": settings.PHONEPE_MERCHANT_ID or "PGPLAYVAL",
                "merchantTransactionId": merchant_txn_id,
                "merchantUserId": str(user_id),
                "amount": amount_paise,
                "redirectUrl": redirect_url,
                "redirectMode": "POST",
                "callbackUrl": callback_url,
                "paymentInstrument": {
                    "type": "PAY_PAGE"
                }
            }
            
            payload_json = json.dumps(payload)
            base64_payload = base64.b64encode(payload_json.encode("utf-8")).decode("utf-8")
            
            # 2. X-VERIFY signature
            salt_key = settings.PHONEPE_SALT_KEY or "d55883d6-4447-49cf-8980-df70f1a9bfa5"
            salt_index = settings.PHONEPE_SALT_INDEX
            
            sign_str = base64_payload + "/pg/v1/pay" + salt_key
            sha256_hash = hashlib.sha256(sign_str.encode("utf-8")).hexdigest()
            x_verify = f"{sha256_hash}###{salt_index}"
            
            # 3. Call PhonePe API
            api_url = (
                "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"
                if settings.PHONEPE_ENV == "UAT"
                else "https://api.phonepe.com/apis/hermes/pg/v1/pay"
            )
            
            web_redirect_url = redirect_url
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.post(
                        api_url,
                        json={"request": base64_payload},
                        headers={
                            "Content-Type": "application/json",
                            "X-VERIFY": x_verify,
                        },
                        timeout=10
                    )
                    if res.status_code == 200:
                        res_data = res.json()
                        if res_data.get("success") and "data" in res_data:
                            # Extract redirect URL from PhonePe response
                            instrument = res_data["data"]["instrumentResponse"]
                            if "redirectInfo" in instrument:
                                web_redirect_url = instrument["redirectInfo"]["url"]
            except Exception as e:
                logger.error("PhonePe API call failed, using default callback redirect", error=str(e))

            pp_record = PhonepeTransaction(
                payment_id=payment.id,
                merchant_transaction_id=merchant_txn_id,
                amount=amount_paise,
                redirect_url=web_redirect_url,
            )
            self.db.add(pp_record)
            await self.db.flush()

            return {
                "payment_id": str(payment.id),
                "gateway": "phonepe",
                "merchant_transaction_id": merchant_txn_id,
                "redirect_url": web_redirect_url,
                "amount": amount,
            }

        elif gateway == PaymentGateway.CASHFREE:
            import httpx
            order_ref = f"CF_{secrets.token_hex(8).upper()}"
            payment.gateway_order_id = order_ref

            cf_base = (
                "https://sandbox.cashfree.com/pg"
                if settings.CASHFREE_ENV == "sandbox"
                else "https://api.cashfree.com/pg"
            )

            payment_session_id = f"mock_session_{secrets.token_hex(10)}"

            if settings.cashfree_enabled:
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.post(
                            f"{cf_base}/orders",
                            json={
                                "order_id": order_ref,
                                "order_amount": round(amount, 2),
                                "order_currency": "INR",
                                "customer_details": {
                                    "customer_id": str(user_id),
                                    "customer_email": "customer@sbjiwala.qzz.io",
                                    "customer_phone": "9999999999",
                                },
                                "order_meta": {
                                    "return_url": f"{settings.APP_URL}/payment/callback?order_id={str(order_id)}&payment_id={str(payment.id)}",
                                    "notify_url": f"{settings.APP_URL}/api/v1/payments/webhook/cashfree",
                                },
                            },
                            headers={
                                "x-api-version": "2023-08-01",
                                "x-client-id": settings.CASHFREE_APP_ID,
                                "x-client-secret": settings.CASHFREE_SECRET_KEY,
                                "Content-Type": "application/json",
                            },
                            timeout=10,
                        )
                        if resp.status_code in (200, 201):
                            cf_data = resp.json()
                            payment_session_id = cf_data.get("payment_session_id", payment_session_id)
                except Exception as e:
                    logger.error("Cashfree order creation failed", error=str(e))

            await self.db.flush()
            return {
                "payment_id": str(payment.id),
                "gateway": "cashfree",
                "cashfree_order_id": order_ref,
                "payment_session_id": payment_session_id,
                "amount": amount,
                "env": settings.CASHFREE_ENV,
            }

        return {"error": "Unsupported payment gateway"}

    async def verify_signature(
        self,
        gateway: str,
        gateway_order_id: str,
        gateway_payment_id: str,
        gateway_signature: str
    ) -> bool:
        """Verify Razorpay webhook signature."""
        if gateway == "razorpay":
            if not settings.RAZORPAY_KEY_SECRET:
                return True  # Bypass in dev if keys are not set
            
            try:
                # signature verification
                msg = f"{gateway_order_id}|{gateway_payment_id}"
                generated_signature = hmac.new(
                    settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                    msg.encode("utf-8"),
                    hashlib.sha256
                ).hexdigest()
                return hmac.compare_digest(generated_signature, gateway_signature)
            except Exception as e:
                logger.error("Razorpay signature verification exception", error=str(e))
                return False
        return True

    async def confirm_payment(
        self,
        payment_id: UUID,
        gateway_payment_id: str,
        gateway_signature: Optional[str] = None,
        method: Optional[str] = None,
        method_details: Optional[dict] = None
    ) -> bool:
        """Confirm a pending payment and update order status."""
        result = await self.db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.is_deleted == False)
        )
        payment = result.scalars().first()
        if not payment:
            return False

        payment.status = PaymentStatus.COMPLETED
        payment.gateway_payment_id = gateway_payment_id
        payment.gateway_signature = gateway_signature
        payment.payment_method = method
        payment.method_details = method_details or {}
        payment.completed_at = datetime.now(timezone.utc)

        # Update order status
        order_result = await self.db.execute(
            select(Order).where(Order.id == payment.order_id)
        )
        order = order_result.scalars().first()
        if order:
            order.payment_status = "paid"
            order.payment_id = payment.id
            # Leave status as PENDING, awaiting Admin confirmation

        await self.db.flush()
        return True
