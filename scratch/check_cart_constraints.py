import asyncio
import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../apps/backend")))
from app.db.session import async_session_factory

async def main():
    async with async_session_factory() as session:
        # Check unique constraints on carts table
        res = await session.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE conrelid = 'carts'::regclass;
        """))
        print("Constraints on carts table:")
        for row in res:
            print(f"  {row[0]}: {row[1]}")

        # Check indexes on carts table
        res_idx = await session.execute(text("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'carts';
        """))
        print("\nIndexes on carts table:")
        for row in res_idx:
            print(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(main())
