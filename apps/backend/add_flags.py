import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    POSTGRES_USER = os.getenv("DATABASE_USER", "sbjiwala")
    POSTGRES_PASSWORD = os.getenv("DATABASE_PASSWORD", "password")
    POSTGRES_HOST = os.getenv("DATABASE_HOST", "server")
    POSTGRES_PORT = os.getenv("DATABASE_PORT", "5432")
    POSTGRES_DB = os.getenv("DATABASE_DB", "sbjiwala")
    DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_async_engine(DATABASE_URL)

async def main():
    async with engine.begin() as conn:
        try:
            print("Adding boolean flags to vendor_delivery_rules...")
            await conn.execute(text("ALTER TABLE vendor_delivery_rules ADD COLUMN is_delivery_fee_enabled BOOLEAN NOT NULL DEFAULT TRUE"))
        except Exception as e:
            print("is_delivery_fee_enabled error:", e)
    
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE vendor_delivery_rules ADD COLUMN is_platform_fee_enabled BOOLEAN NOT NULL DEFAULT TRUE"))
        except Exception as e:
            print("is_platform_fee_enabled error:", e)

    print("Done")

if __name__ == "__main__":
    asyncio.run(main())
