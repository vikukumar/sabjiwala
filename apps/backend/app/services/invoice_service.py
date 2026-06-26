"""
Service to generate PDF invoices using Jinja2 and WeasyPrint.
"""
import io
import os
from typing import List, Optional
from datetime import datetime, timezone
import structlog
from jinja2 import Environment, FileSystemLoader

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.models.order import Order, OrderItem
from app.services.storage_service import StorageService

logger = structlog.get_logger()

# Setup Jinja2 Environment
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))


class InvoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_invoice_pdf(self, order: Order, items: List[OrderItem]) -> bytes:
        """
        Generates a PDF invoice for the given order using the HTML template.
        """
        from weasyprint import HTML, CSS

        template = env.get_template("invoice.html")
        from app.services.notification_service import get_frontend_url
        frontend_url = get_frontend_url()
        
        # Fetch social settings
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
            logger.error("Failed to load social settings for invoice PDF", error=str(e))

        html_out = template.render(
            order=order,
            items=items,
            frontend_url=frontend_url,
            logo_horizontal=f"{frontend_url}/logo_horizontal.png",
            logo_vertical=f"{frontend_url}/logo_vertical.png",
            **social_vars
        )

        # Generate PDF using WeasyPrint
        pdf_bytes = HTML(string=html_out, base_url=frontend_url).write_pdf()
        return pdf_bytes

    async def generate_and_upload_invoice(self, order_id: str) -> Optional[str]:
        """
        Generates an invoice and uploads it to storage, returning the public URL.
        Updates the order metadata with the invoice URL.
        """
        try:
            # 1. Fetch Order and Items
            result = await self.db.execute(
                select(Order).options(selectinload(Order.items).selectinload(OrderItem.vendor)).where(Order.id == order_id)
            )
            order = result.scalars().first()
            if not order:
                logger.error(f"Order not found for invoice generation: {order_id}")
                return None

            # 2. Generate PDF Bytes
            pdf_bytes = await self.generate_invoice_pdf(order, list(order.items))

            # 3. Upload to StorageService
            storage_service = StorageService(self.db)
            filename = f"Invoice_{order.id}.pdf"
            
            file_meta = await storage_service.save_file(
                file_bytes=pdf_bytes,
                original_filename=filename,
                owner_id=order.user_id,
                bucket="invoices",
                is_public=True,
                entity_type="order",
                entity_id=str(order.id)
            )

            invoice_url = file_meta.public_url

            # 4. Update order metadata
            metadata = order.metadata_json or {}
            metadata["invoice_url"] = invoice_url
            order.metadata_json = metadata
            
            self.db.add(order)
            await self.db.commit()
            
            logger.info(f"Invoice generated and uploaded for order {order.id}: {invoice_url}")
            return invoice_url

        except Exception as e:
            logger.exception(f"Failed to generate and upload invoice for order {order_id}: {str(e)}")
            return None
