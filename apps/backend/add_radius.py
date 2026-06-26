import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    POSTGRES_USER = os.getenv("DATABASE_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("DATABASE_PASSWORD", "postgres")
    POSTGRES_HOST = os.getenv("DATABASE_HOST", "localhost")
    POSTGRES_PORT = os.getenv("DATABASE_PORT", "5432")
    POSTGRES_DB = os.getenv("DATABASE_DB", "sbjiwala")
    DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_async_engine(DATABASE_URL)

async def main():
    async with engine.begin() as conn:
        try:
            print("Adding service_radius_km to vendor_stores...")
            await conn.execute(text("ALTER TABLE vendor_stores ADD COLUMN IF NOT EXISTS service_radius_km FLOAT"))
            print("Added successfully!")
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
