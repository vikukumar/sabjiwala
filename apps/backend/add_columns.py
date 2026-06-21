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
            print("Adding columns to vendor_delivery_rules...")
            await conn.execute(text("ALTER TABLE vendor_delivery_rules ADD COLUMN platform_fee NUMERIC(10, 2)"))
            await conn.execute(text("ALTER TABLE vendor_delivery_rules ADD COLUMN convenience_fee NUMERIC(10, 2)"))
        except Exception as e:
            print("vendor_delivery_rules error:", e)
            
        try:
            print("Adding columns to orders...")
            await conn.execute(text("ALTER TABLE orders ADD COLUMN original_delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE orders ADD COLUMN platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE orders ADD COLUMN convenience_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.0"))
        except Exception as e:
            print("orders error:", e)

    print("Done")

if __name__ == "__main__":
    asyncio.run(main())
