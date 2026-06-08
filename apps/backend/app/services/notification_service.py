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
            logger.warning("Recipient user not found for dispatch", user_id=str(user_id), event=event_key)
            return

        # Fetch template
        template_result = await self.db.execute(
            select(NotificationTemplate).where(NotificationTemplate.event_key == event_key, NotificationTemplate.is_active == True)
        )
        template = template_result.scalars().first()
        if not template:
            logger.warning("Active notification template not found", event=event_key)
            return

        channels = template.channels or []

        # Render helper
        def render(tpl_str: Optional[str]) -> str:
            if not tpl_str:
                return ""
            try:
                return Template(tpl_str).render(**variables)
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
        if "email" in channels and user.email and template.email_body:
            email_q = EmailQueue(
                to_email=user.email,
                to_name=f"{user.first_name} {user.last_name}".strip(),
                subject=render(template.email_subject),
                body_html=render(template.email_body),
                template_id=template.id,
                reference_type=reference_type,
                reference_id=reference_id,
            )
            self.db.add(email_q)

        # 3. SMS Queueing
        if "sms" in channels and user.phone and template.sms_body:
            sms_q = SmsQueue(
                to_phone=user.phone,
                message=render(template.sms_body),
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
                        await send_fcm_legacy_push(
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
    import anyio
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_CLAIMS_EMAIL:
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
            vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"}
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

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_USE_TLS,
            start_tls=settings.SMTP_START_TLS,
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

        # Build payload based on settings/MSG91 format
        payload = {
            "mobile": sms_q.to_phone,
            "message": sms_q.message,
            "authkey": settings.SMS_GATEWAY_KEY,
            "sender": settings.SMS_SENDER_ID,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(settings.SMS_GATEWAY_URL, json=payload, timeout=10)
            
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


async def send_fcm_legacy_push(token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> bool:
    """Send a legacy FCM notification via HTTP POST to Google's legacy endpoint."""
    import httpx
    if not settings.FCM_SERVER_KEY:
        logger.warning("FCM server key not configured, push notification logged but not sent", token=token)
        return False

    url = "https://fcm.googleapis.com/fcm/send"
    headers = {
        "Authorization": f"key={settings.FCM_SERVER_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "to": token,
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
            "badge": "1",
            "click_action": "FLUTTER_NOTIFICATION_CLICK"
        },
        "data": data or {}
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            logger.info("FCM push notification sent successfully", token=token)
            return True
        else:
            logger.error("FCM service returned non-200 status", status=response.status_code, response=response.text)
            return False
    except Exception as e:
        logger.error("Failed to send FCM push notification", error=str(e), token=token)
        return False
