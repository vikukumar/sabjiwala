"""
Database Seeding Script — populates initial categories, products, vendor stores, and inventory.
"""
import secrets
from datetime import datetime, timezone
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserProfile, UserType, Role, UserRole
from app.models.product import Category, Product, ProductStatus
from app.models.vendor import Vendor, VendorStore, VendorStatus, VendorDeliveryRule, VendorWallet
from app.models.payment import Wallet, WalletType
from app.models.product import Inventory
from app.core.security.password import hash_password

logger = structlog.get_logger()

CATEGORIES = [
    {"name": "Vegetables", "slug": "vegetables", "sort_order": 1},
    {"name": "Leafy Greens", "slug": "leafy-greens", "sort_order": 2},
    {"name": "Exotics", "slug": "exotics", "sort_order": 3},
    {"name": "Herbs", "slug": "herbs", "sort_order": 4},
]

PRODUCTS = [
    {"name": "Farm Fresh Tomatoes", "slug": "farm-fresh-tomatoes", "unit": "1 kg", "price": 40.0, "image": "🍅", "category_slug": "vegetables"},
    {"name": "Organic Potatoes", "slug": "organic-potatoes", "unit": "1 kg", "price": 30.0, "image": "🥔", "category_slug": "vegetables"},
    {"name": "Fresh Coriander Leaves", "slug": "fresh-coriander-leaves", "unit": "100 g", "price": 15.0, "image": "🌿", "category_slug": "leafy-greens"},
    {"name": "Sweet Hybrid Corn", "slug": "sweet-hybrid-corn", "unit": "1 pc", "price": 25.0, "image": "🌽", "category_slug": "vegetables"},
    {"name": "Fresh English Cucumber", "slug": "fresh-english-cucumber", "unit": "500 g", "price": 45.0, "image": "🥒", "category_slug": "exotics"},
    {"name": "Organic Red Onions", "slug": "organic-red-onions", "unit": "1 kg", "price": 35.0, "image": "🧅", "category_slug": "vegetables"},
]

async def seed_database(db: AsyncSession) -> None:
    """Idempotent seed script to populate catalog and a default vendor."""
    await logger.ainfo("Starting database seeding...")

    # 1. Seed Categories
    category_map = {}
    for cat_def in CATEGORIES:
        res = await db.execute(select(Category).where(Category.slug == cat_def["slug"]))
        cat = res.scalars().first()
        if not cat:
            cat = Category(
                name=cat_def["name"],
                slug=cat_def["slug"],
                sort_order=cat_def["sort_order"],
                is_active=True,
                level=0
            )
            db.add(cat)
            await db.flush()
            await logger.ainfo(f"Seeded category: {cat.name}")
        category_map[cat_def["slug"]] = cat.id

    # 2. Seed default admin user if not exists
    admin_email = "admin@sbjiwala.in"
    res = await db.execute(select(User).where(User.email == admin_email))
    admin_user = res.scalars().first()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            password_hash=hash_password("admin123"),
            first_name="Platform",
            last_name="Admin",
            user_type=UserType.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
        )
        db.add(admin_user)
        await db.flush()
        
        profile = UserProfile(user_id=admin_user.id)
        db.add(profile)
        
        # Assign role
        role_res = await db.execute(select(Role).where(Role.name == "super_admin"))
        role = role_res.scalars().first()
        if role:
            db.add(UserRole(user_id=admin_user.id, role_id=role.id))
        await db.flush()
        await logger.ainfo("Seeded default admin user")

    # 3. Seed default vendor user & profile if not exists
    vendor_email = "vendor@sbjiwala.in"
    res = await db.execute(select(User).where(User.email == vendor_email))
    vendor_user = res.scalars().first()
    if not vendor_user:
        vendor_user = User(
            email=vendor_email,
            password_hash=hash_password("vendor123"),
            first_name="Green",
            last_name="Grocers",
            user_type=UserType.VENDOR,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
        )
        db.add(vendor_user)
        await db.flush()
        
        profile = UserProfile(user_id=vendor_user.id)
        db.add(profile)
        
        # Assign role
        role_res = await db.execute(select(Role).where(Role.name == "vendor"))
        role = role_res.scalars().first()
        if role:
            db.add(UserRole(user_id=vendor_user.id, role_id=role.id))
        await db.flush()
        await logger.ainfo("Seeded default vendor user")

    # 3. Seed Vendor profile & Vendor Store if not exists
    res = await db.execute(select(Vendor).where(Vendor.user_id == vendor_user.id))
    vendor = res.scalars().first()
    if not vendor:
        vendor = Vendor(
            user_id=vendor_user.id,
            business_name="Green Grocers Ltd",
            slug="green-grocers-ltd",
            status=VendorStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            commission_rate=0.05,
            average_rating=4.8,
            total_orders=84,
            is_featured=True,
            contact_email=vendor_email,
            contact_phone="9876543210"
        )
        db.add(vendor)
        await db.flush()

        # Vendor Store
        store = VendorStore(
            vendor_id=vendor.id,
            store_name="Green Grocers Main Vashi",
            address_line_1="Sector 14, Vashi",
            city="Navi Mumbai",
            state="Maharashtra",
            country="India",
            postal_code="400703",
            latitude=19.0760,
            longitude=72.9977,
            is_open=True
        )
        db.add(store)

        # Delivery rules
        rule = VendorDeliveryRule(
            vendor_id=vendor.id,
            base_delivery_charge=30.0,
            per_km_charge=5.0,
            max_delivery_distance_km=12.0,
            min_order_amount=99.0,
            free_delivery_above=299.0
        )
        db.add(rule)

        # Vendor Wallet
        vw = VendorWallet(
            vendor_id=vendor.id,
            balance=1450.0,
            pending_balance=0.0,
            total_earned=1450.0
        )
        db.add(vw)
        
        await db.flush()
        await logger.ainfo("Seeded default vendor store configuration")

    # 4. Seed Products and Inventory
    for prod_def in PRODUCTS:
        res = await db.execute(select(Product).where(Product.slug == prod_def["slug"]))
        product = res.scalars().first()
        if not product:
            product = Product(
                name=prod_def["name"],
                slug=prod_def["slug"],
                description=f"Fresh quality {prod_def['name']} sourced directly from farms.",
                unit=prod_def["unit"],
                unit_value=1.0,
                category_id=category_map[prod_def["category_slug"]],
                status=ProductStatus.ACTIVE,
                is_featured=True,
                attributes={"image_emoji": prod_def["image"]}
            )
            db.add(product)
            await db.flush()
            await logger.ainfo(f"Seeded product: {product.name}")

        # Seed inventory for this product at default vendor store
        inv_res = await db.execute(select(Inventory).where(Inventory.product_id == product.id, Inventory.vendor_id == vendor.id))
        inventory = inv_res.scalars().first()
        if not inventory:
            inventory = Inventory(
                product_id=product.id,
                vendor_id=vendor.id,
                quantity=100.0,
                unit_price=prod_def["price"],
                is_in_stock=True,
                is_unlimited=False,
                low_stock_threshold=10.0
            )
            db.add(inventory)
            await logger.ainfo(f"Seeded inventory for {product.name} with price ₹{prod_def['price']}")

    # 5. Seed a default Customer User
    customer_email = "customer@sbjiwala.in"
    res = await db.execute(select(User).where(User.email == customer_email))
    customer_user = res.scalars().first()
    if not customer_user:
        customer_user = User(
            email=customer_email,
            password_hash=hash_password("customer123"),
            first_name="Rahul",
            last_name="Sharma",
            user_type=UserType.CUSTOMER,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
        )
        db.add(customer_user)
        await db.flush()
        
        profile = UserProfile(user_id=customer_user.id)
        db.add(profile)
        
        # Address
        from app.models.user import UserAddress
        address = UserAddress(
            user_id=customer_user.id,
            label="Home",
            full_name="Rahul Sharma",
            phone="9820012345",
            address_line_1="Flat 402, Shiv Shakti Tower",
            address_line_2="Sector 17, Vashi",
            city="Navi Mumbai",
            state="Maharashtra",
            country="India",
            postal_code="400703",
            latitude=19.0735,
            longitude=72.9985,
            is_default=True,
            formatted_address="Flat 402, Shiv Shakti Tower, Sector 17, Vashi, Navi Mumbai, Maharashtra, 400703"
        )
        db.add(address)
        
        # Wallet
        wallet = Wallet(
            user_id=customer_user.id,
            wallet_type=WalletType.CUSTOMER,
            balance=500.0,
            pending_balance=0.0
        )
        db.add(wallet)

        # Assign role
        role_res = await db.execute(select(Role).where(Role.name == "customer"))
        role = role_res.scalars().first()
        if role:
            db.add(UserRole(user_id=customer_user.id, role_id=role.id))
        await db.flush()
        await logger.ainfo("Seeded default customer user")

    # 6. Seed a default Delivery Boy
    delivery_email = "delivery@sbjiwala.in"
    res = await db.execute(select(User).where(User.email == delivery_email))
    delivery_user = res.scalars().first()
    if not delivery_user:
        delivery_user = User(
            email=delivery_email,
            password_hash=hash_password("delivery123"),
            first_name="Amit",
            last_name="Verma",
            user_type=UserType.DELIVERY_BOY,
            is_active=True,
            is_verified=True,
            is_email_verified=True,
        )
        db.add(delivery_user)
        await db.flush()
        
        profile = UserProfile(user_id=delivery_user.id)
        db.add(profile)
        
        # Delivery Wallet
        from app.models.delivery import DeliveryBoy
        dboy = DeliveryBoy(
            user_id=delivery_user.id,
            vehicle_type="bike",
            vehicle_number="MH-43-AB-1234",
            status="approved",
            is_available=True
        )
        db.add(dboy)

        wallet = Wallet(
            user_id=delivery_user.id,
            wallet_type=WalletType.DELIVERY,
            balance=100.0,
            pending_balance=0.0
        )
        db.add(wallet)

        # Assign role
        role_res = await db.execute(select(Role).where(Role.name == "delivery_boy"))
        role = role_res.scalars().first()
        if role:
            db.add(UserRole(user_id=delivery_user.id, role_id=role.id))
        await db.flush()
        await logger.ainfo("Seeded default delivery partner user")

    await db.commit()
    await logger.ainfo("Database seeding completed successfully.")
