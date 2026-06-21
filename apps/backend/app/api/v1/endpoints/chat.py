import asyncio
import json
import structlog
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import APIResponse
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.chat import LiveChatSession, LiveChatMessage, ChatSessionStatus, ChatMessageSender, FAQ, FAQCategory
from app.services.chat_service import allocate_agent, get_faqs_for_bot, handle_bot_interaction
from app.websocket.manager import ws_manager

logger = structlog.get_logger()
router = APIRouter()


@router.websocket("/ws")
async def chat_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None),
    guest_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for Live Chat.
    Handles Customer -> Agent, Guest -> Agent, and Bot logic.
    """
    await websocket.accept()
    
    # 1. Identify User (Customer/Agent/Guest)
    user_id = None
    user_type = None
    if token:
        # Simplistic token decoding for WS context
        from app.core.security.jwt import decode_token
        try:
            payload = decode_token(token)
            user_id = UUID(payload.get("sub"))
            user_type = payload.get("role")
            
            # Register with global WS manager
            await ws_manager.connect(websocket, user_id)
        except Exception:
            pass

    # For guests or customers, find/create session
    chat_session = None
    if session_id:
        try:
            sid = UUID(session_id)
            stmt = select(LiveChatSession).where(LiveChatSession.id == sid)
            res = await db.execute(stmt)
            chat_session = res.scalars().first()
        except Exception:
            pass

    if not chat_session and user_type not in ["admin", "support_agent"]:
        # Create new session
        chat_session = LiveChatSession(
            customer_id=user_id if user_type == "customer" else None,
            guest_id=guest_id,
            status=ChatSessionStatus.WAITING
        )
        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)

        # Allocate Agent
        agent_id = await allocate_agent(db, chat_session)
        if agent_id:
            # Notify agent
            await ws_manager.send_to_user(agent_id, {
                "type": "new_chat_assigned",
                "session_id": str(chat_session.id)
            })
            await websocket.send_json({"type": "agent_assigned", "message": "An agent has joined the chat."})
        else:
            chat_session.status = ChatSessionStatus.BOT
            await db.commit()
            
            faqs = await get_faqs_for_bot(db)
            await websocket.send_json({
                "type": "bot_greeting", 
                "message": "Hi! All our agents are currently busy. How can I help you today?",
                "faqs": faqs
            })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                msg_type = payload.get("type")
                content = payload.get("message")
                
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                    
                if not content or not chat_session:
                    continue

                # Save message
                sender_type = ChatMessageSender.CUSTOMER
                if user_type in ["admin", "support_agent"]:
                    sender_type = ChatMessageSender.AGENT
                    
                chat_msg = LiveChatMessage(
                    session_id=chat_session.id,
                    sender_type=sender_type,
                    sender_id=str(user_id) if user_id else guest_id,
                    message=content
                )
                db.add(chat_msg)
                await db.commit()
                
                # Route message
                if chat_session.status == ChatSessionStatus.BOT and sender_type == ChatMessageSender.CUSTOMER:
                    ticket = await handle_bot_interaction(db, chat_session, content)
                    if ticket:
                        await websocket.send_json({
                            "type": "bot_ticket_created",
                            "message": f"I have created a support ticket for your issue. Ticket ID: {ticket.ticket_number}. Our team will get back to you shortly via email/SMS.",
                            "ticket_number": ticket.ticket_number
                        })
                elif chat_session.status == ChatSessionStatus.ACTIVE:
                    # Forward to the other party
                    target_id = chat_session.agent_id if sender_type == ChatMessageSender.CUSTOMER else chat_session.customer_id
                    if target_id:
                        await ws_manager.send_to_user(target_id, {
                            "type": "chat_message",
                            "session_id": str(chat_session.id),
                            "sender_type": sender_type.value,
                            "message": content
                        })
                    # If guest, they are connected to this local socket directly, handled by read loop.
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        if user_id:
            ws_manager.disconnect(websocket, user_id)


@router.get("/sessions", response_model=APIResponse)
async def get_active_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get active chat sessions assigned to the current agent."""
    user_id = UUID(current_user["sub"])
    stmt = select(LiveChatSession).where(
        LiveChatSession.agent_id == user_id,
        LiveChatSession.status == ChatSessionStatus.ACTIVE
    ).order_by(LiveChatSession.created_at.desc())
    
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    
    return APIResponse(success=True, data=[{
        "id": str(s.id),
        "customer_id": str(s.customer_id) if s.customer_id else None,
        "guest_id": s.guest_id,
        "status": s.status.value,
        "assigned_at": s.assigned_at
    } for s in sessions])


@router.get("/sessions/{session_id}/messages", response_model=APIResponse)
async def get_session_messages(
    session_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Fetch history of a specific chat session."""
    stmt = select(LiveChatMessage).where(LiveChatMessage.session_id == session_id).order_by(LiveChatMessage.created_at.asc())
    res = await db.execute(stmt)
    messages = res.scalars().all()
    
    return APIResponse(success=True, data=[{
        "id": str(m.id),
        "sender_type": m.sender_type.value,
        "sender_id": m.sender_id,
        "message": m.message,
        "created_at": m.created_at
    } for m in messages])

from pydantic import BaseModel

class ChatMessageCreate(BaseModel):
    message: str

@router.post("/sessions/{session_id}/messages", response_model=APIResponse)
async def send_session_message(
    session_id: UUID,
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Send a message to a chat session (used by Agents)."""
    user_id = UUID(current_user["sub"])
    
    stmt = select(LiveChatSession).where(LiveChatSession.id == session_id)
    res = await db.execute(stmt)
    chat_session = res.scalars().first()
    
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    chat_msg = LiveChatMessage(
        session_id=session_id,
        sender_type=ChatMessageSender.AGENT,
        sender_id=str(user_id),
        message=payload.message
    )
    db.add(chat_msg)
    await db.commit()
    
    # Notify Customer via WebSocket
    if chat_session.customer_id:
        await ws_manager.send_to_user(chat_session.customer_id, {
            "type": "chat_message",
            "session_id": str(session_id),
            "sender_type": "agent",
            "message": payload.message
        })
    else:
        # Broadcasting to guest? We don't have user_id for guest connected via WS, 
        # so we broadcast to the guest's unique ID if we registered it as user_id.
        # Let's try sending to guest_id as a string, but ws_manager expects UUID.
        # For full guest support, guest UUIDs should be generated or handled in WS.
        pass
        
    return APIResponse(success=True, message="Message sent")
