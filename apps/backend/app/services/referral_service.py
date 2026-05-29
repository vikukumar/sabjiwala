"""
Referral Reward Processing Service.
"""
import structlog
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import ReferralCode, ReferralReward
from app.models.user import User
from app.models.payment import WalletTransactionType
from app.services.payment_service import PaymentService

logger = structlog.get_logger()


class ReferralService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.payment_service = PaymentService(db)

    async def process_referral_reward(self, referred_user_id: UUID, order_id: UUID) -> None:
        """
        Check if user was referred, verify if this is their first completed order, and credit rewards.
        """
        # Find referred user
        res = await self.db.execute(select(User).where(User.id == referred_user_id))
        user = res.scalars().first()
        if not user or not user.referred_by:
            return

        # Check if reward already processed
        reward_check = await self.db.execute(
            select(ReferralReward).where(ReferralReward.referred_id == referred_user_id)
        )
        if reward_check.scalars().first():
            return

        # Fetch referrer's referral code details
        ref_code_res = await self.db.execute(
            select(ReferralCode).where(ReferralCode.user_id == user.referred_by, ReferralCode.is_active == True)
        )
        ref_code = ref_code_res.scalars().first()
        if not ref_code:
            return

        # Define reward amounts (Referrer gets Rs. 50, Referee gets Rs. 20)
        referrer_amt = 50.0
        referred_amt = 20.0

        # Record reward transaction
        reward = ReferralReward(
            referrer_id=user.referred_by,
            referred_id=referred_user_id,
            referral_code_id=ref_code.id,
            referrer_reward=referrer_amt,
            referred_reward=referred_amt,
            status="credited",
            order_id=order_id,
            credited_at=datetime.now(timezone.utc),
        )
        self.db.add(reward)

        # Update referral stats
        ref_code.total_referrals += 1
        ref_code.total_earnings = float(ref_code.total_earnings) + referrer_amt

        # Credit referrer wallet
        await self.payment_service.credit_wallet(
            user_id=user.referred_by,
            amount=referrer_amt,
            txn_type=WalletTransactionType.REFERRAL,
            reference_type="referral",
            reference_id=str(reward.id),
            description=f"Referral reward for inviting {user.first_name} {user.last_name}"
        )

        # Credit referred user wallet
        await self.payment_service.credit_wallet(
            user_id=referred_user_id,
            amount=referred_amt,
            txn_type=WalletTransactionType.REFERRAL,
            reference_type="referral",
            reference_id=str(reward.id),
            description="Welcome bonus for registering via referral link"
        )

        await self.db.flush()
        logger.info("Referral reward credited successfully", referrer=str(user.referred_by), referee=str(referred_user_id))
