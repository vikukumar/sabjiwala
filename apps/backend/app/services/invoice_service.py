"""
Service to generate PDF invoices using Jinja2 and xhtml2pdf.
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

from xhtml2pdf import pisa

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
        template = env.get_template("invoice.html")
        html_out = template.render(order=order, items=items)

        # Generate PDF
        result_file = io.BytesIO()
        pisa_status = pisa.CreatePDF(
            io.StringIO(html_out),
            dest=result_file
        )

        if pisa_status.err:
            logger.error(f"Error generating PDF invoice for order {order.id}")
            raise RuntimeError(f"PDF generation failed for order {order.id}")

        return result_file.getvalue()

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
                owner_id=order.customer_id,
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
