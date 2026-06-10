import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../apps/backend')))

import asyncio
import websockets
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.session import async_session_factory
from app.core.security.jwt import create_access_token
from app.models.user import User

async def main():
    async with async_session_factory() as session:
        user_res = await session.execute(select(User).limit(1))
        user = user_res.scalars().first()
        if not user:
            print("No users found.")
            return
        
        token = create_access_token(user.id, "customer")
        
    uri = f"ws://localhost:8000/ws?token={token}"
    print(f"Connecting to {uri}")
    try:
        async with websockets.connect(uri) as ws:
            print("Connected!")
            await ws.send('{"type": "ping"}')
            response = await ws.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
