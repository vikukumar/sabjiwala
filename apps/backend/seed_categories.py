#!/usr/bin/env python3
"""
Seed default product categories for Sbjiwala platform.
Adds all vegetables, fruits, dairy, and other grocery categories with
subcategories, emojis, and metadata.

Usage:
    python seed_categories.py [--api-url http://localhost:8000] [--token YOUR_ADMIN_TOKEN]
    Or run directly against the database.
"""

import asyncio
import os
import sys
import re
import secrets
from typing import Optional

# ─── Category Tree ─────────────────────────────────────────────────────────────
# Format: (name, icon, description, sort_order, subcategories)
CATEGORY_TREE = [
    (
        "Vegetables", "🥦",
        "Fresh farm-to-table vegetables delivered daily",
        1,
        [
            ("Leafy Greens", "🥬", "Spinach, lettuce, methi and more", 1),
            ("Root Vegetables", "🥕", "Carrots, beetroot, radish, turnips", 2),
            ("Gourds & Squash", "🥒", "Bottle gourd, ridge gourd, bitter gourd, pumpkin", 3),
            ("Tomatoes & Peppers", "🍅", "Tomatoes, capsicum, green chili, red pepper", 4),
            ("Onions & Garlic", "🧅", "Onions, garlic, shallots, spring onions", 5),
            ("Beans & Peas", "🫘", "French beans, cluster beans, peas, edamame", 6),
            ("Cabbage & Cauliflower", "🫑", "Cabbage, cauliflower, broccoli, Brussels sprouts", 7),
            ("Potatoes & Yams", "🥔", "Potatoes, sweet potatoes, yam, arbi (taro)", 8),
            ("Exotic Vegetables", "🌽", "Baby corn, asparagus, zucchini, leek, artichoke", 9),
        ]
    ),
    (
        "Fruits", "🍎",
        "Fresh seasonal fruits sourced from local farms",
        2,
        [
            ("Citrus Fruits", "🍋", "Oranges, lemons, limes, grapefruit, mosambi", 1),
            ("Tropical Fruits", "🍌", "Bananas, mangoes, pineapple, papaya, guava", 2),
            ("Berries", "🍓", "Strawberries, blueberries, raspberries, gooseberries", 3),
            ("Stone Fruits", "🍑", "Peaches, plums, apricots, cherries, litchi", 4),
            ("Melons", "🍈", "Watermelon, muskmelon, honeydew", 5),
            ("Apples & Pears", "🍐", "Red apple, green apple, pear varieties", 6),
            ("Grapes & Pomegranate", "🍇", "Green grapes, black grapes, pomegranate", 7),
            ("Dry Fruits & Nuts", "🥜", "Cashews, almonds, walnuts, raisins, dates", 8),
            ("Exotic Fruits", "🥭", "Dragon fruit, kiwi, avocado, passion fruit", 9),
        ]
    ),
    (
        "Dairy & Eggs", "🥛",
        "Fresh dairy products, paneer, and eggs",
        3,
        [
            ("Milk", "🥛", "Full-fat, toned, skimmed, and flavored milk", 1),
            ("Paneer & Tofu", "🧀", "Fresh paneer, tofu, and cottage cheese", 2),
            ("Curd & Yoghurt", "🫙", "Dahi, Greek yoghurt, probiotic yoghurt", 3),
            ("Butter & Ghee", "🧈", "Salted butter, white butter, pure desi ghee", 4),
            ("Cheese", "🧀", "Processed cheese, mozzarella, cheddar", 5),
            ("Eggs", "🥚", "Chicken eggs, organic eggs, quail eggs", 6),
            ("Cream & Condensed Milk", "🥫", "Whipping cream, cooking cream, condensed milk", 7),
        ]
    ),
    (
        "Herbs & Spices", "🌿",
        "Aromatic herbs, fresh masalas and spice blends",
        4,
        [
            ("Fresh Herbs", "🌿", "Coriander, mint, curry leaves, basil, dill", 1),
            ("Whole Spices", "🌶️", "Cumin, coriander seeds, cardamom, cloves, cinnamon", 2),
            ("Ground Spices", "🫙", "Turmeric, red chili powder, garam masala, cumin powder", 3),
            ("Ginger & Turmeric", "🧄", "Fresh ginger, turmeric root, galangal", 4),
        ]
    ),
    (
        "Grains & Cereals", "🌾",
        "Staple grains, lentils, and cereals",
        5,
        [
            ("Rice & Pulses", "🍚", "Basmati rice, broken rice, moong dal, toor dal, chana dal", 1),
            ("Wheat & Flour", "🫓", "Whole wheat flour, maida, semolina, besan", 2),
            ("Millets & Oats", "🌾", "Bajra, jowar, ragi, rolled oats, quinoa", 3),
            ("Poha & Upma Mix", "🥣", "Poha, sooji, idli rava, rice flakes", 4),
        ]
    ),
    (
        "Organic & Natural", "🌱",
        "Certified organic and naturally grown produce",
        6,
        [
            ("Organic Vegetables", "🥦", "NPOP-certified organic vegetables", 1),
            ("Organic Fruits", "🍎", "Naturally grown, pesticide-free fruits", 2),
            ("Organic Dairy", "🥛", "Organic milk, desi cow ghee, A2 milk", 3),
            ("Superfoods", "🌿", "Moringa, ashwagandha, chia seeds, flaxseeds", 4),
        ]
    ),
    (
        "Flowers & Plants", "🌸",
        "Fresh flowers for puja and home decor",
        7,
        [
            ("Puja Flowers", "🌸", "Marigold, roses, jasmine, lotus for worship", 1),
            ("Seasonal Bouquets", "💐", "Mixed bouquets and floral arrangements", 2),
            ("Potted Plants", "🪴", "Indoor plants, succulents, and herb plants", 3),
        ]
    ),
    (
        "Bakery & Snacks", "🍞",
        "Fresh baked goods and healthy snacks",
        8,
        [
            ("Breads & Buns", "🍞", "Whole wheat bread, multigrain, buns, pav", 1),
            ("Cookies & Biscuits", "🍪", "Digestive, cream biscuits, tea time cookies", 2),
            ("Namkeen & Chips", "🥨", "Bhujia, mixture, popcorn, wafers, murukku", 3),
            ("Health Bars", "🫘", "Protein bars, granola bars, muesli", 4),
        ]
    ),
    (
        "Beverages", "🧃",
        "Juices, smoothies, and refreshing drinks",
        9,
        [
            ("Fresh Juices", "🍊", "Freshly squeezed orange, mosambi, pomegranate juice", 1),
            ("Coconut Water", "🥥", "Tender coconut water, packaged coconut water", 2),
            ("Herbal Drinks", "🍵", "Tulsi water, lemon ginger, aam panna", 3),
        ]
    ),
]


async def seed_via_api(api_url: str, token: str) -> None:
    """Seed categories via the REST API."""
    import httpx

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=30) as client:
        # Check existing categories
        resp = await client.get("/api/v1/catalog/categories", params={"all_levels": True})
        existing = {c["name"].lower() for c in (resp.json().get("data") or [])}
        print(f"Found {len(existing)} existing categories.")

        created_parents: dict[str, str] = {}  # name -> id
        total_created = 0

        for parent_name, icon, desc, sort, subcats in CATEGORY_TREE:
            if parent_name.lower() not in existing:
                payload = {
                    "name": parent_name,
                    "icon": icon,
                    "description": desc,
                    "sort_order": sort,
                    "is_active": True,
                    "parent_id": None,
                }
                r = await client.post("/api/v1/products/categories", json=payload)
                if r.status_code == 201:
                    cat_id = r.json().get("data", {}).get("id")
                    created_parents[parent_name] = cat_id
                    total_created += 1
                    print(f"  ✅ Created parent: {parent_name} ({cat_id})")
                else:
                    print(f"  ❌ Failed to create {parent_name}: {r.text}")
                    continue
            else:
                # Fetch ID of existing parent
                resp2 = await client.get("/api/v1/catalog/categories", params={"all_levels": True})
                for c in (resp2.json().get("data") or []):
                    if c["name"].lower() == parent_name.lower():
                        created_parents[parent_name] = c["id"]
                        break
                print(f"  ⏭️  Skipped (exists): {parent_name}")

            parent_id = created_parents.get(parent_name)
            if not parent_id:
                continue

            for sub_name, sub_icon, sub_desc, sub_sort in subcats:
                if sub_name.lower() not in existing:
                    sub_payload = {
                        "name": sub_name,
                        "icon": sub_icon,
                        "description": sub_desc,
                        "sort_order": sub_sort,
                        "parent_id": parent_id,
                        "is_active": True,
                    }
                    r2 = await client.post("/api/v1/products/categories", json=sub_payload)
                    if r2.status_code == 201:
                        total_created += 1
                        print(f"    ✅ Created subcategory: {sub_name}")
                    else:
                        print(f"    ❌ Failed: {sub_name}: {r2.text[:100]}")
                else:
                    print(f"    ⏭️  Skipped (exists): {sub_name}")

        print(f"\n🎉 Done! Created {total_created} categories/subcategories.")


async def seed_direct_db() -> None:
    """Seed categories directly into the database (for server-side use)."""
    import re
    import secrets
    
    # Force process directory to script parent dir to guarantee correct .env lookup
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    sys.path.insert(0, os.path.join(backend_dir, "app"))

    from app.db.session import async_session_factory
    from app.models.product import Category

    def slugify(text: str) -> str:
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[-\s]+", "-", text)
        return text[:100] + "-" + secrets.token_hex(3)

    async with async_session_factory() as db:
        from sqlalchemy import select
        existing_result = await db.execute(select(Category).where(Category.is_deleted == False))
        existing_names = {c.name.lower() for c in existing_result.scalars().all()}
        print(f"Found {len(existing_names)} existing active categories.")

        total_created = 0
        total_updated = 0
        from uuid import UUID
        parent_ids: dict[str, UUID] = {}

        for parent_name, icon, desc, sort, subcats in CATEGORY_TREE:
            if parent_name.lower() not in existing_names:
                cat = Category(
                    name=parent_name,
                    slug=slugify(parent_name),
                    icon=icon,
                    description=desc,
                    sort_order=sort,
                    level=0,
                    is_active=True,
                )
                db.add(cat)
                await db.flush()
                parent_ids[parent_name] = cat.id
                total_created += 1
                print(f"  ✅ Created: {parent_name}")
            else:
                result = await db.execute(
                    select(Category).where(
                        Category.name == parent_name,
                        Category.is_deleted == False,
                    )
                )
                existing_cat = result.scalars().first()
                if existing_cat:
                    parent_ids[parent_name] = existing_cat.id
                    existing_cat.icon = icon
                    existing_cat.description = desc
                    existing_cat.sort_order = sort
                    # Self-heal parent attributes if needed
                    if existing_cat.level != 0 or existing_cat.parent_id is not None:
                        existing_cat.level = 0
                        existing_cat.parent_id = None
                    total_updated += 1
                    print(f"  ⚙️  Updated parent structure & details: {parent_name}")
                else:
                    print(f"  ⏭️  Exists: {parent_name} (Record missing, skipping)")

            pid = parent_ids.get(parent_name)
            if not pid:
                continue

            for sub_name, sub_icon, sub_desc, sub_sort in subcats:
                result = await db.execute(
                    select(Category).where(
                        Category.name == sub_name,
                        Category.is_deleted == False,
                    )
                )
                existing_sub = result.scalars().first()

                if not existing_sub:
                    sub = Category(
                        name=sub_name,
                        slug=slugify(sub_name),
                        icon=sub_icon,
                        description=sub_desc,
                        sort_order=sub_sort,
                        parent_id=pid,
                        level=1,
                        is_active=True,
                    )
                    db.add(sub)
                    total_created += 1
                    print(f"    ✅ Created sub: {sub_name}")
                else:
                    existing_sub.icon = sub_icon
                    existing_sub.description = sub_desc
                    existing_sub.sort_order = sub_sort
                    # Self-heal subcategory if parent_id or level is incorrect
                    if existing_sub.parent_id != pid or existing_sub.level != 1:
                        existing_sub.parent_id = pid
                        existing_sub.level = 1
                    total_updated += 1
                    print(f"    ⚙️  Updated sub parent/level & details: {sub_name}")

        await db.commit()
        print(f"\n🎉 Done! Created {total_created} and self-healed {total_updated} categories.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed Sbjiwala categories")
    parser.add_argument("--api-url", default=None, help="API base URL (e.g. https://api.sbjiwala.qzz.io)")
    parser.add_argument("--token", default=None, help="Admin bearer token for API mode")
    args = parser.parse_args()

    if args.api_url and args.token:
        asyncio.run(seed_via_api(args.api_url, args.token))
    else:
        print("Running in direct DB mode (requires backend environment)...")
        asyncio.run(seed_direct_db())
