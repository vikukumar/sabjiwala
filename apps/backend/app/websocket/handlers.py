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
from app.models.delivery import DeliveryBoy, DeliveryLocation, AvailabilityStatus
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
            "role": payload.get("role", "customer"),
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

            # Handle live GPS tracking updates from delivery boys
            elif event_type == "location_update" and role == "delivery_boy":
                latitude = payload.get("latitude")
                longitude = payload.get("longitude")
                accuracy = payload.get("accuracy")
                speed = payload.get("speed")
                heading = payload.get("heading")
                order_id_str = payload.get("order_id")

                if latitude is not None and longitude is not None:
                    order_id = UUID(order_id_str) if order_id_str else None
                    
                    # Store location in database
                    async with async_session_factory() as db:
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

                            # Broadcast location update to relevant order tracking channel (customer/vendor)
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
                                            }
                                        }
                                    )

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WebSocket runtime error", error=str(e), user_id=str(user_id))
        ws_manager.disconnect(websocket, user_id)
