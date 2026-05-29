"""
Support ticket management API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import APIResponse, TicketCreate, TicketMessageCreate
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.support import SupportTicket, SupportMessage, Dispute

router = APIRouter()


@router.post("/tickets", response_model=APIResponse, status_code=201)
async def create_ticket(
    body: TicketCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support assistance request ticket."""
    ticket = SupportTicket(
        user_id=current_user["user_id"],
        subject=body.subject,
        category=body.category,
        order_id=body.order_id,
        status="open",
        priority="medium",
    )
    db.add(ticket)
    await db.flush()

    # Create initial message
    msg = SupportMessage(
        ticket_id=ticket.id,
        sender_id=current_user["user_id"],
        sender_type=current_user.get("role", "customer"),
        message=body.description,
    )
    db.add(msg)
    await db.commit()

    return APIResponse(
        success=True,
        message="Ticket created successfully",
        data={"ticket_id": str(ticket.id), "ticket_number": ticket.ticket_number}
    )


@router.get("/tickets", response_model=APIResponse)
async def list_tickets(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List customer support tickets."""
    role = current_user.get("role", "customer")
    query = select(SupportTicket).where(SupportTicket.is_deleted == False).order_by(desc(SupportTicket.created_at))

    if role == "customer":
        query = query.where(SupportTicket.user_id == current_user["user_id"])
    elif role == "support_agent":
        # Support agent sees everything
        pass
    else:
        raise HTTPException(status_code=403, detail="Permission denied")

    result = await db.execute(query)
    tickets = result.scalars().all()

    data = []
    for t in tickets:
        data.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "category": t.category,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat(),
        })

    return APIResponse(success=True, data=data)


@router.get("/tickets/{ticket_id}", response_model=APIResponse)
async def get_ticket_details(
    ticket_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details and messages thread for a support ticket."""
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id, SupportTicket.is_deleted == False)
    )
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Visibility check
    role = current_user.get("role", "customer")
    if role == "customer" and ticket.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    messages_data = []
    for m in ticket.messages:
        if not m.is_deleted:
            messages_data.append({
                "id": str(m.id),
                "sender_id": str(m.sender_id),
                "sender_type": m.sender_type,
                "message": m.message,
                "attachments": m.attachments,
                "created_at": m.created_at.isoformat(),
            })

    return APIResponse(
        success=True,
        data={
            "id": str(ticket.id),
            "ticket_number": ticket.ticket_number,
            "subject": ticket.subject,
            "category": ticket.category,
            "status": ticket.status,
            "priority": ticket.priority,
            "messages": messages_data
        }
    )


@router.post("/tickets/{ticket_id}/messages", response_model=APIResponse)
async def post_ticket_message(
    ticket_id: UUID,
    body: TicketMessageCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post a message reply on a support ticket thread."""
    # Find ticket
    res = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.is_deleted == False))
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Check permission
    role = current_user.get("role", "customer")
    if role == "customer" and ticket.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user["user_id"],
        sender_type=role,
        message=body.message,
        attachments=body.attachments or [],
    )
    db.add(msg)

    # Re-open if solved and customer replies
    if role == "customer" and ticket.status in ["solved", "closed"]:
        ticket.status = "open"

    await db.commit()
    return APIResponse(success=True, message="Message sent successfully")
