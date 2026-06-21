import structlog
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import LiveChatSession, LiveChatMessage, ChatSessionStatus, ChatMessageSender, FAQ, FAQCategory
from app.models.support import SupportAgentProfile, SupportTicket, TicketStatus, TicketPriority

logger = structlog.get_logger()


async def allocate_agent(db: AsyncSession, session: LiveChatSession) -> Optional[UUID]:
    """
    Round Robin agent allocation logic.
    Find an available agent with the least active chats.
    """
    # 1. Get all available agents
    stmt = select(SupportAgentProfile).where(SupportAgentProfile.is_available == True)
    result = await db.execute(stmt)
    agents = result.scalars().all()

    if not agents:
        logger.info("No agents available for live chat.", session_id=str(session.id))
        return None

    agent_ids = [a.user_id for a in agents]

    # 2. Find the agent with the minimum number of active chats
    # Count active sessions per agent
    counts_stmt = (
        select(LiveChatSession.agent_id, func.count(LiveChatSession.id).label('active_count'))
        .where(
            LiveChatSession.agent_id.in_(agent_ids),
            LiveChatSession.status == ChatSessionStatus.ACTIVE
        )
        .group_by(LiveChatSession.agent_id)
    )
    counts_result = await db.execute(counts_stmt)
    active_counts = {row.agent_id: row.active_count for row in counts_result}

    # Assign to agent with minimum count
    best_agent_id = agent_ids[0]
    min_count = active_counts.get(best_agent_id, 0)

    for aid in agent_ids[1:]:
        c = active_counts.get(aid, 0)
        if c < min_count:
            min_count = c
            best_agent_id = aid

    logger.info("Agent allocated for live chat.", session_id=str(session.id), agent_id=str(best_agent_id))
    
    session.agent_id = best_agent_id
    session.status = ChatSessionStatus.ACTIVE
    session.assigned_at = datetime.now(timezone.utc)
    await db.flush()
    return best_agent_id


async def get_faqs_for_bot(db: AsyncSession) -> List[Dict[str, Any]]:
    """Fetch FAQs grouped by category for the bot fallback."""
    stmt = select(FAQCategory).where(FAQCategory.is_active == True).order_by(FAQCategory.sort_order)
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    bot_options = []
    for cat in categories:
        cat_stmt = select(FAQ).where(FAQ.category_id == cat.id, FAQ.is_active == True).order_by(FAQ.sort_order)
        cat_result = await db.execute(cat_stmt)
        faqs = cat_result.scalars().all()
        
        bot_options.append({
            "category_id": str(cat.id),
            "category_name": cat.name,
            "faqs": [
                {"id": str(faq.id), "question": faq.question, "answer": faq.answer}
                for faq in faqs
            ]
        })
    return bot_options


async def handle_bot_interaction(db: AsyncSession, session: LiveChatSession, message_text: str) -> Optional[SupportTicket]:
    """
    Handle incoming message when in BOT status.
    If user indicates they want to raise an issue/ticket, create it.
    """
    msg_lower = message_text.lower().strip()
    
    # Simple keyword detection for ticket creation
    trigger_words = ["ticket", "issue", "problem", "human", "agent", "support", "help"]
    wants_human = any(word in msg_lower for word in trigger_words)
    
    if wants_human and len(message_text) > 10:
        import secrets
        # Create a support ticket
        ticket_number = f"TCK-{secrets.token_hex(4).upper()}"
        
        # Determine user id or fallback (e.g. system default if guest, or raise error, but here we save guest_id)
        # Assuming we have a default system user for guests or allow nullable user_id in ticket
        # In support.py, SupportTicket.user_id is not nullable. 
        # If customer_id is None (guest), we might not be able to create a full ticket without email.
        if not session.customer_id:
            # We need an email for guests. This is a simplified fallback.
            return None
            
        ticket = SupportTicket(
            ticket_number=ticket_number,
            user_id=session.customer_id,
            subject="Live Chat Escalation",
            description=message_text,
            category="general",
            status=TicketStatus.OPEN,
            priority=TicketPriority.MEDIUM
        )
        db.add(ticket)
        await db.flush()
        
        logger.info("Bot created support ticket", ticket_number=ticket.ticket_number, session_id=str(session.id))
        return ticket
        
    return None
