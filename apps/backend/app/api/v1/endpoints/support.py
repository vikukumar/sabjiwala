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
from app.models.support import SupportTicket, SupportMessage, Dispute, SupportAgentProfile, SupportCallLog, TicketStatus

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
        status=TicketStatus.OPEN,
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

    # Re-open if resolved/closed and customer replies
    if role == "customer" and ticket.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        ticket.status = TicketStatus.OPEN

    await db.commit()
    return APIResponse(success=True, message="Message sent successfully")


@router.get("/agents", response_model=APIResponse)
async def list_support_agents(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all support agents and their availability."""
    from app.models.user import User, UserType

    query = select(User).where(User.user_type == UserType.SUPPORT_AGENT, User.is_deleted == False)
    res = await db.execute(query)
    agents = res.scalars().all()

    data = []
    for agent in agents:
        ap_res = await db.execute(select(SupportAgentProfile).where(SupportAgentProfile.user_id == agent.id))
        ap = ap_res.scalars().first()
        data.append({
            "id": str(agent.id),
            "email": agent.email,
            "first_name": agent.first_name,
            "last_name": agent.last_name,
            "is_available": ap.is_available if ap else False,
        })
    return APIResponse(success=True, data=data)


@router.get("/agent/profile", response_model=APIResponse)
async def get_support_agent_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get active support agent availability and voicemails."""
    
    ap_res = await db.execute(select(SupportAgentProfile).where(SupportAgentProfile.user_id == current_user["user_id"]))
    ap = ap_res.scalars().first()
    if not ap:
        # Create one dynamically if missing
        ap = SupportAgentProfile(user_id=current_user["user_id"], is_available=True)
        db.add(ap)
        await db.commit()

    return APIResponse(
        success=True,
        data={
            "user_id": str(ap.user_id),
            "is_available": ap.is_available,
            "voicemails": ap.voicemails or []
        }
    )


@router.patch("/agent/profile", response_model=APIResponse)
async def update_support_agent_profile(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle agent online/offline status."""
    
    ap_res = await db.execute(select(SupportAgentProfile).where(SupportAgentProfile.user_id == current_user["user_id"]))
    ap = ap_res.scalars().first()
    if not ap:
        ap = SupportAgentProfile(user_id=current_user["user_id"], is_available=True)
        db.add(ap)
        await db.flush()

    if "is_available" in body:
        ap.is_available = body["is_available"]

    await db.commit()
    return APIResponse(success=True, message="Profile updated successfully", data={"is_available": ap.is_available})


@router.post("/tickets/{ticket_id}/assign", response_model=APIResponse)
async def assign_ticket(
    ticket_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-assign or transfer support ticket to another agent."""
    res = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.is_deleted == False))
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    assigned_to = body.get("assigned_to")
    assigned_to_uuid = None
    if assigned_to:
        try:
            assigned_to_uuid = UUID(str(assigned_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid agent UUID format")
    
    ticket.assigned_to = assigned_to_uuid
    
    # Post a system comment indicating reassignment
    from app.models.user import User
    agent_name = "Unassigned"
    if assigned_to_uuid:
        u_res = await db.execute(select(User).where(User.id == assigned_to_uuid))
        u = u_res.scalars().first()
        if u:
            agent_name = f"{u.first_name} {u.last_name}"

    sys_msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user["user_id"],
        sender_type="support_agent",
        message=f"Ticket re-assigned to {agent_name}.",
        is_internal=True,
        message_type="system"
    )
    db.add(sys_msg)
    await db.commit()
    return APIResponse(success=True, message=f"Ticket assigned to {agent_name}")


@router.post("/tickets/{ticket_id}/refund", response_model=APIResponse)
async def refund_ticket_order(
    ticket_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process wallet refund for the ticket's associated order."""
    res = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.is_deleted == False))
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not ticket.order_id:
        raise HTTPException(status_code=400, detail="Ticket is not associated with any order")

    amount = float(body.get("amount", 0))
    reason = body.get("reason", "Refunded by support agent")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be positive")

    from app.models.order import Order
    order_res = await db.execute(select(Order).where(Order.id == ticket.order_id))
    order = order_res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")

    # Credit the user's wallet
    from app.services.payment_service import PaymentService
    from app.models.payment import WalletTransactionType
    
    payment_service = PaymentService(db)
    await payment_service.credit_wallet(
        user_id=ticket.user_id,
        amount=amount,
        txn_type=WalletTransactionType.REFUND,
        description=f"Refund for Order #{order.order_number}: {reason}"
    )

    # Post a system comment indicating refund
    sys_msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user["user_id"],
        sender_type="support_agent",
        message=f"Issued a refund of ₹{amount}. Reason: {reason}",
        is_internal=False,
        message_type="system"
    )
    db.add(sys_msg)
    
    # Also update ticket internal comments
    internal_msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user["user_id"],
        sender_type="support_agent",
        message=f"Refund of ₹{amount} successfully credited to wallet.",
        is_internal=True,
        message_type="text"
    )
    db.add(internal_msg)
    
    await db.commit()
    return APIResponse(success=True, message=f"Refund of ₹{amount} processed successfully")


@router.post("/tickets/{ticket_id}/notes", response_model=APIResponse)
async def post_internal_note(
    ticket_id: UUID,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post an internal note (for support agent eyes only)."""
    res = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.is_deleted == False))
    ticket = res.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message_text = body.get("message")
    if not message_text:
        raise HTTPException(status_code=400, detail="Message is required")

    msg = SupportMessage(
        ticket_id=ticket_id,
        sender_id=current_user["user_id"],
        sender_type=current_user.get("role", "support_agent"),
        message=message_text,
        is_internal=True,
        message_type="text"
    )
    db.add(msg)
    await db.commit()
    return APIResponse(success=True, message="Internal note added successfully")


@router.get("/calls/logs", response_model=APIResponse)
async def get_call_logs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get call history logs."""
    from sqlalchemy import desc

    role = current_user.get("role", "support_agent")
    query = select(SupportCallLog).order_by(desc(SupportCallLog.created_at))
    
    if role == "support_agent":
        query = query.where(SupportCallLog.agent_id == current_user["user_id"])
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    data = []
    for log in logs:
        data.append({
            "id": str(log.id),
            "caller_name": f"{log.caller.first_name} {log.caller.last_name}" if log.caller else "Unknown",
            "caller_role": log.caller.user_type.value if log.caller else "customer",
            "caller_phone": log.caller.phone if log.caller else "",
            "status": log.status,
            "duration_seconds": log.duration_seconds,
            "created_at": log.created_at.isoformat()
        })
    return APIResponse(success=True, data=data)

