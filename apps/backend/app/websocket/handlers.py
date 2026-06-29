"""
WebSocket request entry points and location update streaming.
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID
import json
import structlog

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.websocket.manager import ws_manager
from app.core.security.jwt import decode_token
from app.models.delivery import DeliveryBoy, DeliveryLocation, AvailabilityStatus, VendorDeliveryLocation
from app.models.order import Order

logger = structlog.get_logger()
router = APIRouter()


async def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT token to authenticate WebSocket connection."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return {
            "user_id": UUID(payload["sub"]),
            "role": payload.get("user_type", payload.get("role", "customer")),
        }
    except Exception:
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    Main WebSocket endpoint for real-time notifications, ordering state and delivery tracking.
    """
    user_info = await get_user_from_token(token)
    if not user_info:
        await websocket.close(code=4008) # Policy Violation
        return

    user_id = user_info["user_id"]
    role = user_info["role"]

    await ws_manager.connect(websocket, user_id)

    try:
        while True:
            # Receive text or JSON data
            data = await websocket.receive_text()
            message = json.loads(data)
            
            event_type = message.get("type")
            payload = message.get("data", {})

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif event_type == "call_initiate":
                from app.models.support import SupportAgentProfile
                async with async_session_factory() as db:
                    agent_res = await db.execute(
                        select(SupportAgentProfile).where(SupportAgentProfile.is_available == True)
                    )
                    available_profiles = agent_res.scalars().all()
                    
                active_agents = [ap for ap in available_profiles if ap.user_id in ws_manager.active_connections]
                if active_agents:
                    for ap in active_agents:
                        await ws_manager.send_to_user(
                            ap.user_id,
                            {
                                "type": "incoming_call",
                                "data": {
                                    "caller_id": str(user_id),
                                    "caller_role": role,
                                    "caller_name": payload.get("caller_name", "Valued User"),
                                    "caller_phone": payload.get("caller_phone", ""),
                                }
                            }
                        )
                else:
                    await websocket.send_json({
                        "type": "call_rejected",
                        "data": {"reason": "no_agents_available"}
                    })

            elif event_type in ["call_offer", "call_answer", "ice_candidate"]:
                target_id = payload.get("target_id")
                if target_id:
                    await ws_manager.send_to_user(
                        UUID(target_id),
                        {
                            "type": event_type,
                            "data": {
                                "sender_id": str(user_id),
                                "sdp": payload.get("sdp"),
                                "candidate": payload.get("candidate")
                            }
                        }
                    )

            elif event_type == "call_hangup":
                target_id = payload.get("target_id")
                duration = payload.get("duration", 0)
                status = payload.get("status", "completed")
                
                async with async_session_factory() as db:
                    from app.models.support import SupportCallLog
                    is_agent = (role == "support_agent")
                    caller_id_val = UUID(target_id) if is_agent else user_id
                    agent_id_val = user_id if is_agent else (UUID(target_id) if target_id else None)
                    
                    call_log = SupportCallLog(
                        caller_id=caller_id_val,
                        agent_id=agent_id_val,
                        status=status,
                        duration_seconds=int(duration)
                    )
                    db.add(call_log)
                    await db.commit()

                if target_id:
                    await ws_manager.send_to_user(
                        UUID(target_id),
                        {
                            "type": "call_disconnected",
                            "data": {"sender_id": str(user_id)}
                        }
                    )

            elif event_type == "call_voicemail":
                audio_url = payload.get("audio_url")
                caller_name = payload.get("caller_name", "Anonymous")
                
                async with async_session_factory() as db:
                    from app.models.support import SupportAgentProfile
                    agent_res = await db.execute(select(SupportAgentProfile))
                    profiles = agent_res.scalars().all()
                    
                    for ap in profiles:
                        vmails = list(ap.voicemails) if ap.voicemails else []
                        vmails.append({
                            "caller_id": str(user_id),
                            "caller_name": caller_name,
                            "audio_url": audio_url,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                        ap.voicemails = vmails
                    await db.commit()

            elif event_type == "agent_status":
                is_available = payload.get("is_available", True)
                async with async_session_factory() as db:
                    from app.models.support import SupportAgentProfile
                    ap_res = await db.execute(select(SupportAgentProfile).where(SupportAgentProfile.user_id == user_id))
                    ap = ap_res.scalars().first()
                    if ap:
                        ap.is_available = is_available
                        await db.commit()

            # Handle live GPS tracking updates from delivery boys or vendors (for self delivery)
            elif event_type == "location_update" and role in ["delivery_boy", "vendor", "vendor_manager"]:
                latitude = payload.get("latitude")
                longitude = payload.get("longitude")
                accuracy = payload.get("accuracy")
                speed = payload.get("speed")
                heading = payload.get("heading")
                order_id_str = payload.get("order_id")

                if latitude is not None and longitude is not None:
                    order_id = UUID(order_id_str) if order_id_str else None
                    
                    async with async_session_factory() as db:
                        if role == "delivery_boy":
                            # Find delivery boy profile
                            boy_res = await db.execute(
                                select(DeliveryBoy).where(DeliveryBoy.user_id == user_id)
                            )
                            boy = boy_res.scalars().first()
                            if boy:
                                boy.current_latitude = latitude
                                boy.current_longitude = longitude
                                boy.last_location_update = datetime.now(timezone.utc)
                                
                                # Log location
                                location_log = DeliveryLocation(
                                    delivery_boy_id=boy.id,
                                    order_id=order_id,
                                    latitude=latitude,
                                    longitude=longitude,
                                    accuracy=accuracy,
                                    speed=speed,
                                    heading=heading,
                                )
                                db.add(location_log)
                                await db.commit()
                        else:
                            # Vendor self delivery location update — persist to DB and broadcast
                            from app.models.vendor import Vendor
                            vendor_res = await db.execute(
                                select(Vendor).where(Vendor.user_id == user_id)
                            )
                            vendor = vendor_res.scalars().first()
                            if vendor:
                                # Persist GPS trail to DB
                                vendor_loc = VendorDeliveryLocation(
                                    vendor_id=vendor.id,
                                    order_id=order_id,
                                    latitude=latitude,
                                    longitude=longitude,
                                    accuracy=accuracy,
                                    speed=speed,
                                    heading=heading,
                                )
                                db.add(vendor_loc)

                                # Update order metadata with live location for HTTP order polling fallback
                                if order_id:
                                    order_res = await db.execute(
                                        select(Order).where(Order.id == order_id)
                                    )
                                    order_obj = order_res.scalars().first()
                                    if order_obj:
                                        from sqlalchemy.orm.attributes import flag_modified
                                        meta = order_obj.metadata_json or {}
                                        meta["live_latitude"] = latitude
                                        meta["live_longitude"] = longitude
                                        order_obj.metadata_json = meta
                                        flag_modified(order_obj, "metadata_json")
                                        db.add(order_obj)
                            await db.commit()

                        # Broadcast location update to relevant order tracking channel (customer)
                        if order_id:
                            # Find order to get customer ID
                            order_res = await db.execute(
                                select(Order).where(Order.id == order_id)
                            )
                            order = order_res.scalars().first()
                            if order:
                                # Send live coordinates to customer
                                await ws_manager.send_to_user(
                                    order.user_id,
                                    {
                                        "type": "live_location",
                                        "data": {
                                            "order_id": str(order_id),
                                            "latitude": latitude,
                                            "longitude": longitude,
                                            "speed": speed,
                                            "heading": heading,
                                            "role": role,
                                        }
                                    }
                                )

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WebSocket runtime error", error=str(e), user_id=str(user_id))
        ws_manager.disconnect(websocket, user_id)
