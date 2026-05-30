"""
WebSocket Connection Manager with Redis Pub/Sub backplane.
"""
import asyncio
import json
import structlog
from typing import Dict, List, Any, Optional
from uuid import UUID

from fastapi import WebSocket
from redis.asyncio import Redis, from_url

from app.core.config import settings

logger = structlog.get_logger()


class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[UUID, List[WebSocket]] = {}
        self.redis_client: Optional[Redis] = None
        self.pubsub_task: Optional[asyncio.Task] = None
        self.channel_name = "sbjiwala:ws:events"

    async def connect_redis(self) -> None:
        """Connect to Redis and start listening to PubSub backplane."""
        self.redis_client = await from_url(settings.redis_url, decode_responses=False)
        self.pubsub_task = asyncio.create_task(self._redis_listener())
        logger.info("WebSocket Redis Pub/Sub connected")

    async def disconnect_redis(self) -> None:
        """Disconnect Redis connection and cancel PubSub task."""
        if self.pubsub_task:
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
        if self.redis_client:
            await self.redis_client.aclose()
            logger.info("WebSocket Redis Pub/Sub disconnected")

    async def connect(self, websocket: WebSocket, user_id: UUID) -> None:
        """Accept WebSocket connection and store locally."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.debug("WebSocket client connected", user_id=str(user_id))

    def disconnect(self, websocket: WebSocket, user_id: UUID) -> None:
        """Clean up disconnected WebSocket from local store."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.debug("WebSocket client disconnected", user_id=str(user_id))

    async def send_to_user(self, user_id: UUID, message: Dict[str, Any]) -> None:
        """
        Send message to user. Publishes to Redis pub/sub to reach all server processes.
        """
        payload = {
            "target_user_id": str(user_id),
            "message": message
        }
        if self.redis_client:
            # Publish event across Redis backplane
            await self.redis_client.publish(self.channel_name, json.dumps(payload))
        else:
            # Fallback to local dispatch if Redis is disabled
            await self._local_send(user_id, message)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """
        Broadcast message to all connected users across all instances.
        """
        payload = {
            "target_user_id": "all",
            "message": message
        }
        if self.redis_client:
            await self.redis_client.publish(self.channel_name, json.dumps(payload))
        else:
            await self._local_broadcast(message)

    async def _local_send(self, user_id: UUID, message: Dict[str, Any]) -> None:
        """Send message only to locally connected clients of the user."""
        if user_id in self.active_connections:
            dead_sockets = []
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    dead_sockets.append(websocket)
            
            # Clean up dead sockets
            for s in dead_sockets:
                self.disconnect(s, user_id)

    async def _local_broadcast(self, message: Dict[str, Any]) -> None:
        """Send message to all locally connected clients."""
        for user_id, sockets in list(self.active_connections.items()):
            dead_sockets = []
            for websocket in sockets:
                try:
                    await websocket.send_json(message)
                except Exception:
                    dead_sockets.append(websocket)
            for s in dead_sockets:
                self.disconnect(s, user_id)

    async def _redis_listener(self) -> None:
        """Listen to Redis channel and forward messages to local WebSockets."""
        pubsub = self.redis_client.pubsub()
        await pubsub.subscribe(self.channel_name)
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"].decode("utf-8"))
                        target = data.get("target_user_id")
                        msg = data.get("message")
                        
                        if target == "all":
                            await self._local_broadcast(msg)
                        else:
                            user_uuid = UUID(target)
                            await self._local_send(user_uuid, msg)
                    except Exception as e:
                        logger.error("Error processing Redis WS backplane message", error=str(e))
        except asyncio.CancelledError:
            await pubsub.unsubscribe(self.channel_name)
            await pubsub.close()


ws_manager = WebSocketManager()
