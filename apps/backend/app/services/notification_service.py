"""
Notification dispatch and queuing service.
"""
import json
import structlog
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID

from jinja2 import Template
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pywebpush import webpush, WebPushException

from app.core.config import settings
from app.models.notification import (
    Notification, NotificationTemplate, PushSubscription, EmailQueue, SmsQueue,
    NotificationType, NotificationChannel, QueueStatus
)
from app.models.user import User

logger = structlog.get_logger()


def get_frontend_url(
    host: Optional[str] = None,
    origin: Optional[str] = None,
    user_agent: Optional[str] = None,
    for_assets: bool = False
) -> str:
    """Derive the frontend URL based on the API settings or the host header/origin."""
    from app.core.config import settings
    # Fallback to configured settings
    url = settings.APP_URL or "http://localhost:8000"
    
    # Check if this is a mobile request
    is_mobile = False
    
    # Check for mobile protocol/schemes in either host or origin
    for val in [origin, host]:
        if val:
            val_lower = val.lower()
            if val_lower.startswith(("capacitor://", "ionic://", "file://")):
                is_mobile = True
                break
            if val_lower in ["http://localhost", "https://localhost"] or val_lower.startswith(("http://localhost:", "https://localhost:")):
                # Port 3000 is the Next.js local web app. If it is NOT 3000, treat as mobile (Capacitor)
                if "localhost:3000" not in val_lower:
                    is_mobile = True
                    break
                    
    # Check User-Agent for mobile indicators
    if not is_mobile and user_agent:
        ua_lower = user_agent.lower()
        if any(keyword in ua_lower for keyword in ["capacitor", "cordova", "sbjiwalamobile", "dart"]):
            is_mobile = True
            
    # Check if we are running in an API request where host matches the backend API url domain
    # and no browser origin is present (indicating native mobile app or direct API call)
    if not is_mobile and host and url:
        from urllib.parse import urlparse
        try:
            api_domain = urlparse(url).netloc
            # If the host string doesn't have a protocol, prepend http:// to parse netloc
            parsed_host = urlparse(host if "://" in host else f"http://{host}").netloc
            if parsed_host == api_domain:
                # If origin is also missing or matches API, treat as mobile/direct API client
                if not origin or urlparse(origin if "://" in origin else f"http://{origin}").netloc == api_domain:
                    is_mobile = True
        except Exception:
            pass

    # If it is NOT a mobile request, we can use the web client's host/origin header
    if not is_mobile:
        target_web = origin or host
        if target_web:
            target_web = target_web.rstrip("/")
            if "://" not in target_web:
                proto = "https" if "localhost" not in target_web and "127.0.0.1" not in target_web else "http"
                res_url = f"{proto}://{target_web}"
            else:
                res_url = target_web
            
            if for_assets and ("localhost" in res_url or "127.0.0.1" in res_url):
                return "https://sbjiwala.qzz.io"
            return res_url
            
    # Fallback/derivation from API APP_URL (for mobile or background tasks/workers)
    res_url = url
    if "api." in url:
        res_url = url.replace("api.", "")
    elif "localhost:8000" in url:
        res_url = url.replace("localhost:8000", "localhost:3000")
    elif "127.0.0.1:8000" in url:
        res_url = url.replace("127.0.0.1:8000", "127.0.0.1:3000")
        
    if for_assets and ("localhost" in res_url or "127.0.0.1" in res_url):
        return "https://sbjiwala.qzz.io"
    return res_url



class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_template_if_not_exists(
        self,
        name: str,
        event_key: str,
        in_app_title: str,
        in_app_body: str,
        email_subject: Optional[str] = None,
        email_body: Optional[str] = None,
        sms_body: Optional[str] = None,
        push_title: Optional[str] = None,
        push_body: Optional[str] = None,
        channels: Optional[List[str]] = None,
    ) -> NotificationTemplate:
        """Create standard notification template if it does not exist."""
        result = await self.db.execute(
            select(NotificationTemplate).where(NotificationTemplate.event_key == event_key)
        )
        template = result.scalars().first()
        if not template:
            template = NotificationTemplate(
                name=name,
                event_key=event_key,
                in_app_title=in_app_title,
                in_app_body=in_app_body,
                email_subject=email_subject,
                email_body=email_body,
                sms_body=sms_body,
                push_title=push_title,
                push_body=push_body,
                channels=channels or ["in_app"],
            )
            self.db.add(template)
            await self.db.flush()
        return template

    async def seed_default_templates(self) -> None:
        """Seed all default bilingual Hinglish notification templates."""
        templates = [
            {
                "name": "Order Placed",
                "event_key": "order_placed",
                "in_app_title": "Aapka Order Place Ho Gaya Hai! 🎉",
                "in_app_body": "Aapka order {{ order_number }} safaltapurvak place ho chuka hai. Total amount ₹{{ total_amount }} hai. Hum jald hi isse confirm karenge.",
                "push_title": "Aapka Order Place Ho Gaya Hai! 🎉",
                "push_body": "Aapka order {{ order_number }} safaltapurvak place ho chuka hai.",
            },
            {
                "name": "Order Confirmed",
                "event_key": "order_confirmed",
                "in_app_title": "Order Confirm Ho Gaya! 👍",
                "in_app_body": "Aapka order {{ order_number }} confirm ho gaya hai. Ab vendor aapka order pack kar raha hai.",
                "push_title": "Order Confirm Ho Gaya! 👍",
                "push_body": "Aapka order {{ order_number }} confirm ho gaya hai.",
            },
            {
                "name": "Order Accepted",
                "event_key": "order_accepted",
                "in_app_title": "Vendor Ne Order Accept Kiya 🛒",
                "in_app_body": "Aapka order {{ order_number }} vendor ne accept kar liya hai aur ab taiyari shuru ho chuki hai.",
                "push_title": "Vendor Ne Order Accept Kiya 🛒",
                "push_body": "Aapka order {{ order_number }} vendor ne accept kar liya hai.",
            },
            {
                "name": "Order Packed",
                "event_key": "order_packed",
                "in_app_title": "Order Pack Ho Gaya! 📦",
                "in_app_body": "Aapka order {{ order_number }} pack ho chuka hai aur delivery boy ka wait kar raha hai.",
                "push_title": "Order Pack Ho Gaya! 📦",
                "push_body": "Aapka order {{ order_number }} pack ho chuka hai.",
            },
            {
                "name": "Order Assigned",
                "event_key": "order_assigned",
                "in_app_title": "Delivery Agent Assigned 🚲",
                "in_app_body": "Aapka order {{ order_number }} ek delivery partner ko saump diya gaya hai.",
                "push_title": "Delivery Agent Assigned 🚲",
                "push_body": "Aapka order {{ order_number }} ek delivery partner ko saump diya gaya hai.",
            },
            {
                "name": "Order Picked",
                "event_key": "order_picked",
                "in_app_title": "Order Pick Up Ho Gaya! 🚀",
                "in_app_body": "Aapka order {{ order_number }} pick ho chuka hai aur jald hi aapke paas pahunchega.",
                "push_title": "Order Pick Up Ho Gaya! 🚀",
                "push_body": "Aapka order {{ order_number }} pick ho chuka.",
            },
            {
                "name": "Order Out For Delivery",
                "event_key": "order_out_for_delivery",
                "in_app_title": "Order Out For Delivery! 🛵",
                "in_app_body": "Khushkhabri! Aapka order {{ order_number }} out for delivery hai. Taiyar rahiye!",
                "push_title": "Order Out For Delivery! 🛵",
                "push_body": "Khushkhabri! Aapka order {{ order_number }} out for delivery hai.",
            },
            {
                "name": "Order Delivered",
                "event_key": "order_delivered",
                "in_app_title": "Order Deliver Ho Gaya! 🏁",
                "in_app_body": "Aapka order {{ order_number }} safaltapurvak deliver ho gaya hai. Sbjiwala se kharidari ke liye dhanyawad!",
                "push_title": "Order Deliver Ho Gaya! 🏁",
                "push_body": "Aapka order {{ order_number }} safaltapurvak deliver ho gaya hai.",
            },
            {
                "name": "Order Cancelled",
                "event_key": "order_cancelled",
                "in_app_title": "Order Cancel Ho Gaya! ❌",
                "in_app_body": "Aapka order {{ order_number }} cancel kar diya gaya hai. Agar koi refund banta hai toh wo aapke wallet mein credit ho jayega.",
                "push_title": "Order Cancel Ho Gaya! ❌",
                "push_body": "Aapka order {{ order_number }} cancel kar diya gaya hai.",
            },
            {
                "name": "Order Refunded",
                "event_key": "order_refunded",
                "in_app_title": "Refund Credit Ho Gaya! 💰",
                "in_app_body": "Aapka refund order {{ order_number }} ke liye credit kar diya gaya hai.",
                "push_title": "Refund Credit Ho Gaya! 💰",
                "push_body": "Aapka refund order {{ order_number }} ke liye credit kar diya gaya hai.",
            },
            {
                "name": "Delivery Assigned",
                "event_key": "delivery_assigned",
                "in_app_title": "Naya Delivery Task! 🚲",
                "in_app_body": "Aapko naya order {{ order_number }} assign kiya gaya hai. Kripya vendor ke paas jaakar pick up karein.",
                "push_title": "Naya Delivery Task! 🚲",
                "push_body": "Aapko naya order {{ order_number }} assign kiya gaya hai.",
            },
            {
                "name": "New Order For Vendor",
                "event_key": "order_new_for_vendor",
                "in_app_title": "Naya Customer Order Aaya! 🛒",
                "in_app_body": "Aapke store mein order {{ order_number }} aaya hai. Total amount ₹{{ total_amount }}. Order accept karein!",
                "push_title": "Naya Customer Order Aaya! 🛒",
                "push_body": "Order {{ order_number }} — ₹{{ total_amount }}. Abhi accept karein!",
            }
        ]
        for t in templates:
            await self.create_template_if_not_exists(
                name=t["name"],
                event_key=t["event_key"],
                in_app_title=t["in_app_title"],
                in_app_body=t["in_app_body"],
                push_title=t.get("push_title"),
                push_body=t.get("push_body"),
                channels=["in_app", "push"],
            )
        await self.seed_default_email_templates()

    async def seed_default_email_templates(self) -> None:
        """Seed beautiful default email templates if they don't exist."""
        from app.models.cms import EmailTemplate
        
        base_html = (
            "<!DOCTYPE html>"
            "<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'></head>"
            "<body style=\"font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 40px 20px; color: #1e293b;\">"
            "<table width='100%' cellpadding='0' cellspacing='0' role='presentation' style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0;'>"
            "<tr><td style='padding: 30px 30px; text-align: center; background: #ffffff; border-bottom: 1px solid #f1f5f9;'>"
            "<img src=\"{{ logo_horizontal }}\" style=\"width: 95px; height: auto; display: block; margin: 0 auto;\" alt=\"Sbjiwala\" />"
            "</td></tr>"
            "<tr><td style='padding: 40px 30px;'>"
            "{content}"
            "</td></tr>"
            "<tr><td style='background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #f1f5f9;'>"
            "{% if social_facebook or social_instagram or social_twitter or social_linkedin or social_youtube %}"
            "<div style=\"margin-bottom: 16px; text-align: center;\">"
            "<p style=\"margin: 0 0 12px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;\">Follow us</p>"
            "{% if social_facebook %}"
            "<a href=\"{{ social_facebook }}\" style=\"margin: 0 8px; text-decoration: none; display: inline-block;\">"
            "<img src=\"https://img.icons8.com/material-outlined/24/059669/facebook-new.png\" width=\"20\" height=\"20\" alt=\"Facebook\" style=\"display: block; border: 0;\" />"
            "</a>"
            "{% endif %}"
            "{% if social_instagram %}"
            "<a href=\"{{ social_instagram }}\" style=\"margin: 0 8px; text-decoration: none; display: inline-block;\">"
            "<img src=\"https://img.icons8.com/material-outlined/24/059669/instagram-new.png\" width=\"20\" height=\"20\" alt=\"Instagram\" style=\"display: block; border: 0;\" />"
            "</a>"
            "{% endif %}"
            "{% if social_twitter %}"
            "<a href=\"{{ social_twitter }}\" style=\"margin: 0 8px; text-decoration: none; display: inline-block;\">"
            "<img src=\"https://img.icons8.com/material-outlined/24/059669/twitter.png\" width=\"20\" height=\"20\" alt=\"Twitter\" style=\"display: block; border: 0;\" />"
            "</a>"
            "{% endif %}"
            "{% if social_linkedin %}"
            "<a href=\"{{ social_linkedin }}\" style=\"margin: 0 8px; text-decoration: none; display: inline-block;\">"
            "<img src=\"https://img.icons8.com/material-outlined/24/059669/linkedin.png\" width=\"20\" height=\"20\" alt=\"LinkedIn\" style=\"display: block; border: 0;\" />"
            "</a>"
            "{% endif %}"
            "{% if social_youtube %}"
            "<a href=\"{{ social_youtube }}\" style=\"margin: 0 8px; text-decoration: none; display: inline-block;\">"
            "<img src=\"https://img.icons8.com/material-outlined/24/059669/youtube-play.png\" width=\"20\" height=\"20\" alt=\"YouTube\" style=\"display: block; border: 0;\" />"
            "</a>"
            "{% endif %}"
            "</div>"
            "{% endif %}"
            "<p style='margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;'>&copy; 2026 Sbjiwala Technologies. All rights reserved.</p>"
            "</td></tr>"
            "</table></body></html>"
        )
        
        default_templates: List[Dict[str, Any]] = [
            {
                "slug": "order_placed",
                "name": "Order Placed Notification",
                "subject": "Order Placed Successfully - Sbjiwala",
                "body_html": base_html.replace("{content}", 
                    "<div style='text-align: center; margin-bottom: 24px;'>"
                    "<img src=\"{{ logo_vertical }}\" style=\"width: 80px; height: auto; display: block; margin: 0 auto 16px auto;\" alt=\"Sbjiwala\" />"
                    "<div style='background-color: #ecfdf5; width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;'><span style='font-size: 32px;'>🎉</span></div>"
                    "<h2 style='font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a;'>Order Placed Successfully!</h2>"
                    "<p style='color: #475569; font-size: 15px; margin: 0;'>Your fresh veggies are being packed.</p>"
                    "</div>"
                    "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px;'>"
                    "<p style='margin: 0 0 12px 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;'>Order Details</p>"
                    "<table style='width: 100%; border-collapse: collapse;'>"
                    "<tr><td style='padding: 8px 0; color: #475569; border-bottom: 1px solid #e2e8f0;'>Order Number:</td><td style='padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0;'>#{{ order_number }}</td></tr>"
                    "<tr><td style='padding: 8px 0; color: #475569; border-bottom: 1px solid #e2e8f0;'>Total Amount:</td><td style='padding: 8px 0; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #e2e8f0;'>₹{{ total_amount }}</td></tr>"
                    "<tr><td style='padding: 8px 0; color: #475569;'>Delivery Address:</td><td style='padding: 8px 0; text-align: right; color: #0f172a;'>{{ delivery_address }}</td></tr>"
                    "</table></div>"
                    "<p style='color: #64748b; font-size: 15px; text-align: center; margin: 0;'>Our delivery partner will arrive at your doorstep shortly.</p>"
                ),
                "body_text": "Hello, thank you for shopping with us! Your order #{{ order_number }} has been placed. Amount: ₹{{ total_amount }}.",
                "variables": ["order_number", "total_amount", "delivery_address"]
            },
            {
                "slug": "order_confirmed",
                "name": "Order Confirmed Notification",
                "subject": "Your Order is Confirmed - Sbjiwala",
                "body_html": base_html.replace("{content}", 
                    "<div style='text-align: center; margin-bottom: 24px;'>"
                    "<img src=\"{{ logo_vertical }}\" style=\"width: 80px; height: auto; display: block; margin: 0 auto 16px auto;\" alt=\"Sbjiwala\" />"
                    "<div style='background-color: #ecfdf5; width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;'><span style='font-size: 32px;'>👍</span></div>"
                    "<h2 style='font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a;'>Order Confirmed!</h2>"
                    "<p style='color: #475569; font-size: 15px; margin: 0; line-height: 1.5;'>We have confirmed your order <strong>#{{ order_number }}</strong>. The vendor is now handpicking and packing your farm fresh greens.</p>"
                    "</div>"
                ),
                "body_text": "Hello, your order #{{ order_number }} has been confirmed and is being packed.",
                "variables": ["order_number"]
            },
            {
                "slug": "order_delivered",
                "name": "Order Delivered Notification",
                "subject": "Order Delivered! 🏁 - Sbjiwala",
                "body_html": base_html.replace("{content}", 
                    "<div style='text-align: center; margin-bottom: 24px;'>"
                    "<img src=\"{{ logo_vertical }}\" style=\"width: 80px; height: auto; display: block; margin: 0 auto 16px auto;\" alt=\"Sbjiwala\" />"
                    "<div style='background-color: #ecfdf5; width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;'><span style='font-size: 32px;'>🏠</span></div>"
                    "<h2 style='font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a;'>Order Delivered Successfully!</h2>"
                    "<p style='color: #475569; font-size: 15px; margin: 0 0 16px 0; line-height: 1.5;'>Your order <strong>#{{ order_number }}</strong> has arrived safely.</p>"
                    "<p style='color: #64748b; font-size: 14px; margin: 0;'>Thank you for choosing Sbjiwala for your daily fresh veggies! Please rate your delivery experience in the app.</p>"
                    "</div>"
                ),
                "body_text": "Hello, your order #{{ order_number }} has been delivered successfully. Thank you!",
                "variables": ["order_number"]
            },
            {
                "slug": "order_refunded",
                "name": "Order Refunded Notification",
                "subject": "Refund Credited to Wallet - Sbjiwala",
                "body_html": base_html.replace("{content}", 
                    "<div style='text-align: center; margin-bottom: 24px;'>"
                    "<img src=\"{{ logo_vertical }}\" style=\"width: 80px; height: auto; display: block; margin: 0 auto 16px auto;\" alt=\"Sbjiwala\" />"
                    "<div style='background-color: #f0fdf4; border: 2px solid #bbf7d0; width: 64px; height: 64px; border-radius: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;'><span style='font-size: 32px; color: #16a34a;'>₹</span></div>"
                    "<h2 style='font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a;'>Refund Processed</h2>"
                    "<p style='color: #475569; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5;'>A refund of <strong>₹{{ refund_amount }}</strong> for order <strong>#{{ order_number }}</strong> has been successfully credited back to your Sbjiwala Wallet.</p>"
                    "<div style='background-color: #f8fafc; border-radius: 12px; padding: 16px; display: inline-block;'>"
                    "<span style='color: #64748b; font-size: 14px;'>You can use this wallet balance seamlessly on your next fresh grocery order!</span>"
                    "</div>"
                    "</div>"
                ),
                "body_text": "Hello, a refund of ₹{{ refund_amount }} for order #{{ order_number }} has been credited to your wallet.",
                "variables": ["order_number", "refund_amount"]
            }
        ]
        
        for t in default_templates:
            res = await self.db.execute(select(EmailTemplate).where(EmailTemplate.slug == t["slug"]))
            existing = res.scalars().first()
            if existing:
                existing.name = t["name"]
                existing.subject = t["subject"]
                existing.body_html = t["body_html"]
                existing.body_text = t["body_text"]
                existing.variables = t["variables"]
            else:
                self.db.add(EmailTemplate(**t))
        await self.db.flush()

    async def dispatch_raw(
        self,
        user_id: UUID,
        title: str,
        body: str,
        event_key: str = "system",
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
    ) -> None:
        """
        Send an in-app notification record + FCM/web push directly
        without requiring a NotificationTemplate in the database.
        Used for vendor/delivery-boy role-specific events.
        """
        from app.models.notification import Notification, PushSubscription
        # 1. Save in-app record
        notif = Notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=event_key,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        self.db.add(notif)

        # 2. Fire FCM / web push to all active subscriptions
        subs_result = await self.db.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.is_active == True
            )
        )
        for sub in subs_result.scalars().all():
            try:
                if sub.endpoint == "fcm":
                    await send_fcm_push(
                        token=sub.auth_key,
                        title=title,
                        body=body,
                        data={"event_key": event_key, "reference_type": reference_type or "", "reference_id": reference_id or ""}
                    )
                else:
                    await any_webpush_send(
                        {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key}},
                        title, body, {"event_key": event_key}
                    )
            except Exception as e:
                logger.debug("dispatch_raw push failed", sub_id=str(sub.id), error=str(e))
                sub.is_active = False

        await self.db.flush()

    async def dispatch(
        self,
        event_key: str,
        user_id: UUID,
        variables: Dict[str, Any],
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None
    ) -> None:
        """
        Find template by event_key, render contents with variables, and dispatch to all enabled channels.
        """
        # Fetch user
        user_result = await self.db.execute(select(User).where(User.id == user_id, User.is_deleted == False))
        user = user_result.scalars().first()
        if not user:
            logger.warning("Recipient user not found for dispatch", user_id=str(user_id), event_key=event_key)
            return

        # Fetch template
        template_result = await self.db.execute(
            select(NotificationTemplate).where(NotificationTemplate.event_key == event_key, NotificationTemplate.is_active == True)
        )
        template = template_result.scalars().first()
        if not template:
            logger.warning("Active notification template not found", event_key=event_key)
            return

        channels = template.channels or []

        # Fetch social media settings
        from app.models.system import SystemSetting
        social_vars = {}
        try:
            settings_result = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key.in_([
                    "social_facebook", "social_instagram", "social_twitter", "social_linkedin", "social_youtube"
                ]))
            )
            for s in settings_result.scalars().all():
                if s.value:
                    social_vars[s.key] = s.value
        except Exception as e:
            logger.error("Failed to load social settings for dispatch", error=str(e))

        req_host = variables.get("request_host")
        req_orig = variables.get("request_origin")
        req_ua = variables.get("request_user_agent")

        # Render helper
        def render(tpl_str: Optional[str]) -> str:
            if not tpl_str:
                return ""
            try:
                render_vars = {
                    "frontend_url": get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua),
                    "logo_horizontal": f"{get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua, for_assets=True)}/logo_horizontal.png",
                    "logo_vertical": f"{get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua, for_assets=True)}/logo_vertical.png",
                    **social_vars,
                    **variables
                }
                return Template(tpl_str).render(**render_vars)
            except Exception as e:
                logger.error("Template rendering failed", error=str(e), template=tpl_str, vars=variables)
                return tpl_str

        # 1. In-App Notification
        if "in_app" in channels and template.in_app_title:
            in_app = Notification(
                user_id=user_id,
                notification_type=NotificationType.SYSTEM,
                title=render(template.in_app_title),
                body=render(template.in_app_body),
                action_url=f"/orders/{reference_id}" if reference_type == "order" else None,
                data={"reference_type": reference_type, "reference_id": reference_id, **variables},
            )
            self.db.add(in_app)
            await self.db.flush()

            # Push real-time event via WebSocket Manager (lazy import to prevent circular)
            try:
                from app.websocket.manager import ws_manager
                await ws_manager.send_to_user(
                    user_id,
                    {
                        "type": "notification",
                        "data": {
                            "id": str(in_app.id),
                            "title": in_app.title,
                            "body": in_app.body,
                            "notification_type": in_app.notification_type.value,
                            "created_at": in_app.created_at.isoformat(),
                        }
                    }
                )
            except Exception as e:
                logger.debug("Real-time WebSocket dispatch failed (user may be offline)", error=str(e))

        # 2. Email Queueing
        if "email" in channels or event_key in ["order_placed", "order_confirmed", "order_delivered", "order_refunded", "order_cancelled", "order_out_for_delivery"]:
            if user.email:
                from app.models.cms import EmailTemplate
                email_template_res = await self.db.execute(
                    select(EmailTemplate).where(EmailTemplate.slug == event_key, EmailTemplate.is_active == True)
                )
                email_template = email_template_res.scalars().first()
                
                subject = ""
                body_html = ""
                body_text = ""
                
                if email_template:
                    try:
                        render_vars = {
                            "frontend_url": get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua),
                            "logo_horizontal": f"{get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua, for_assets=True)}/logo_horizontal.png",
                            "logo_vertical": f"{get_frontend_url(host=req_host, origin=req_orig, user_agent=req_ua, for_assets=True)}/logo_vertical.png",
                            **social_vars,
                            **variables
                        }
                        subject = Template(email_template.subject).render(**render_vars)
                        body_html = Template(email_template.body_html).render(**render_vars)
                        body_text = Template(email_template.body_text or email_template.subject).render(**render_vars)
                    except Exception as e:
                        logger.error("Failed to render custom email template", error=str(e))
                
                # Fallback to system default notification template email fields if dynamic template didn't render
                if not body_html and template.email_body:
                    subject = render(template.email_subject)
                    body_html = render(template.email_body)
                    body_text = render(template.email_subject)
                    
                if body_html:
                    email_q = EmailQueue(
                        to_email=user.email,
                        to_name=f"{user.first_name} {user.last_name}".strip(),
                        subject=subject,
                        body_html=body_html,
                        body_text=body_text,
                        template_id=template.id,
                        reference_type=reference_type,
                        reference_id=reference_id,
                    )
                    self.db.add(email_q)

        # 3. SMS Queueing
        if "sms" in channels or event_key in ["order_placed", "order_confirmed", "order_delivered", "order_refunded", "order_cancelled", "order_out_for_delivery"]:
            if user.phone:
                from app.models.cms import SmsTemplate
                sms_template_res = await self.db.execute(
                    select(SmsTemplate).where(SmsTemplate.slug == event_key, SmsTemplate.is_active == True)
                )
                sms_template = sms_template_res.scalars().first()
                
                sms_message = ""
                if sms_template:
                    try:
                        sms_message = Template(sms_template.message).render(**variables)
                    except Exception as e:
                        logger.error("Failed to render custom SMS template", error=str(e))
                        
                if not sms_message and template.sms_body:
                    sms_message = render(template.sms_body)
                    
                if sms_message:
                    sms_q = SmsQueue(
                        to_phone=user.phone,
                        message=sms_message,
                        reference_type=reference_type,
                        reference_id=reference_id,
                    )
                    self.db.add(sms_q)

        # 4. Push Notifications
        if "push" in channels and template.push_title:
            push_title = render(template.push_title)
            push_body = render(template.push_body)
            # Find active push subscriptions
            subs_result = await self.db.execute(
                select(PushSubscription).where(PushSubscription.user_id == user_id, PushSubscription.is_active == True)
            )
            subscriptions = subs_result.scalars().all()
            for sub in subscriptions:
                # We can dispatch push notifications in background or using Celery tasks,
                # let's trigger it directly asynchronously in a try-block
                try:
                    if sub.endpoint == "fcm":
                        await send_fcm_push(
                            token=sub.auth_key,
                            title=push_title,
                            body=push_body,
                            data={"reference_type": reference_type, "reference_id": reference_id, **variables}
                        )
                    else:
                        subscription_info = {
                            "endpoint": sub.endpoint,
                            "keys": {
                                "p256dh": sub.p256dh_key,
                                "auth": sub.auth_key
                            }
                        }
                        # webpush call
                        await any_webpush_send(subscription_info, push_title, push_body, variables)
                except Exception as e:
                    logger.debug("Failed to send push subscription, marking inactive", sub_id=str(sub.id), error=str(e))
                    sub.is_active = False

        await self.db.flush()


async def any_webpush_send(sub_info: Dict[str, Any], title: str, body: str, data: Dict[str, Any]) -> None:
    """Send web push payload using VAPID private key."""
    import anyio.to_thread
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_SUBJECT:
        logger.warning("VAPID credentials not set, skipping webpush dispatch")
        return

    payload = json.dumps({
        "notification": {
            "title": title,
            "body": body,
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-72x72.png",
            "data": data
        }
    })

    def sync_send():
        webpush(
            subscription_info=sub_info,
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT}
        )

    await anyio.to_thread.run_sync(sync_send)


# Email dispatcher using aiosmtplib (called inside Celery task / runner)
async def send_queued_email(email_q: EmailQueue) -> bool:
    """Send a queued email using configurable SMTP settings."""
    import aiosmtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    if not settings.SMTP_HOST or not settings.SMTP_PORT:
        logger.warning("SMTP server not configured, email logged but not sent", email=email_q.to_email)
        email_q.status = QueueStatus.SENT
        email_q.sent_at = datetime.now(timezone.utc)
        return True

    # Construct email message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_q.subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = email_q.to_email

    # Plain text fallback
    plain_text = email_q.body_text or email_q.subject
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(email_q.body_html, "html"))

    try:
        email_q.status = QueueStatus.PROCESSING
        email_q.attempts += 1
        email_q.last_attempt_at = datetime.now(timezone.utc)

        # Enforce port-based TLS protocol (port 465→SSL, 587→STARTTLS, 25→no TLS)
        _port = settings.SMTP_PORT
        if _port == 465:
            use_tls, start_tls = True, False
        elif _port == 587:
            use_tls, start_tls = False, True
        elif _port == 25:
            use_tls, start_tls = False, False
        else:
            use_tls = settings.SMTP_USE_TLS
            start_tls = settings.SMTP_START_TLS
            if use_tls and start_tls:
                use_tls, start_tls = True, False

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=10,
        )

        email_q.status = QueueStatus.SENT
        email_q.sent_at = datetime.now(timezone.utc)
        email_q.error_message = None
        return True
    except Exception as e:
        logger.error("Failed to send SMTP email", error=str(e), to=email_q.to_email)
        email_q.error_message = str(e)
        email_q.status = QueueStatus.FAILED if email_q.attempts >= email_q.max_attempts else QueueStatus.RETRYING
        return False


# SMS dispatcher using custom MSG91 gateway config
async def send_queued_sms(sms_q: SmsQueue) -> bool:
    """Send queued SMS via SMS API gateway."""
    import httpx

    if not settings.SMS_GATEWAY_URL:
        logger.warning("SMS gateway URL not configured, logging SMS text", phone=sms_q.to_phone, msg=sms_q.message)
        sms_q.status = QueueStatus.SENT
        sms_q.sent_at = datetime.now(timezone.utc)
        return True

    try:
        sms_q.status = QueueStatus.PROCESSING
        sms_q.attempts += 1
        sms_q.last_attempt_at = datetime.now(timezone.utc)

        # Build payload and headers based on SMS provider
        payload = {}
        headers = {}
        
        provider = (settings.SMS_PROVIDER or "msg91").lower()
        if provider in ["android_gateway", "sms_server"]:
            # Standard payload for Android SMS Gateways and local Docker SMS Gateways
            payload = {
                "to": sms_q.to_phone,
                "phone": sms_q.to_phone,
                "message": sms_q.message,
            }
            if settings.SMS_GATEWAY_KEY:
                headers["Authorization"] = f"Bearer {settings.SMS_GATEWAY_KEY}"
                headers["x-api-key"] = settings.SMS_GATEWAY_KEY
        else:
            # Fallback/Default MSG91 / generic format
            payload = {
                "mobile": sms_q.to_phone,
                "message": sms_q.message,
                "authkey": settings.SMS_GATEWAY_KEY,
                "sender": settings.SMS_SENDER_ID,
            }

        async with httpx.AsyncClient() as client:
            response = await client.post(settings.SMS_GATEWAY_URL, json=payload, headers=headers, timeout=10)
            
        sms_q.provider_response = response.json() if "application/json" in response.headers.get("content-type", "") else {"text": response.text}
        
        if response.status_code in [200, 201]:
            sms_q.status = QueueStatus.SENT
            sms_q.sent_at = datetime.now(timezone.utc)
            sms_q.error_message = None
            return True
        else:
            raise Exception(f"Gateway returned status {response.status_code}: {response.text}")

    except Exception as e:
        logger.error("SMS gateway transmission failed", error=str(e), phone=sms_q.to_phone)
        sms_q.error_message = str(e)
        sms_q.status = QueueStatus.FAILED if sms_q.attempts >= sms_q.max_attempts else QueueStatus.RETRYING
        return False


_firebase_app_initialized = False

async def send_fcm_push(token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> bool:
    """Send FCM notification via Firebase Admin SDK (HTTP v1)."""
    global _firebase_app_initialized
    import anyio.to_thread
    
    if not settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON not configured, push notification logged but not sent", token=token)
        return False
        
    def sync_send():
        global _firebase_app_initialized
        import firebase_admin
        from firebase_admin import credentials, messaging
        
        if not _firebase_app_initialized:
            try:
                import json
                import os
                # check if it's a file path or raw JSON string
                sa_val = settings.FIREBASE_SERVICE_ACCOUNT_JSON
                if sa_val.strip().startswith("{"):
                    cred_dict = json.loads(sa_val)
                    cred = credentials.Certificate(cred_dict)
                else:
                    if not os.path.exists(sa_val):
                        logger.error(f"Firebase Service Account file not found: {sa_val}")
                        return False
                    cred = credentials.Certificate(sa_val)
                firebase_admin.initialize_app(cred)
                _firebase_app_initialized = True
            except Exception as e:
                logger.error("Failed to initialize Firebase Admin SDK", error=str(e))
                return False
                
        # Send message
        try:
            # FCM HTTP v1 requires all data values to be strings
            str_data = {str(k): str(v) for k, v in (data or {}).items() if v is not None}
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=str_data,
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='fcm_default_channel'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            response = messaging.send(message)
            logger.info("FCM push notification sent successfully", token=token, message_id=response)
            return True
        except Exception as e:
            logger.error("Failed to send FCM push notification", error=str(e), token=token)
            return False

    return await anyio.to_thread.run_sync(sync_send)
