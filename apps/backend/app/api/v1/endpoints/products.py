"""
Product management endpoints — CRUD, variants, images, bulk import.
"""
import csv
import io
import re
import secrets
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    APIResponse, CategoryResponse, PaginatedResponse, PaginationMeta,
    ProductCreate, ProductResponse, ProductUpdate, CategoryCreate,
)
from app.core.rbac.engine import get_current_user
from app.db.session import get_db
from app.models.product import (
    Category, Inventory, InventoryLog, Product, ProductImage,
    ProductPrice, ProductStatus, ProductVariant,
)
from app.models.vendor import Vendor

router = APIRouter()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text[:200] + "-" + secrets.token_hex(3)


@router.post("", response_model=APIResponse[ProductResponse], status_code=201)
async def create_product(
    body: ProductCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product (vendor only)."""
    # Get vendor
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=403, detail="Vendor profile required")

    # Verify category exists
    cat_result = await db.execute(select(Category).where(Category.id == body.category_id, Category.is_deleted == False))
    category = cat_result.scalars().first()
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")

    from app.models.vendor import VendorStatus
    prod_status = ProductStatus.ACTIVE
    if vendor.status != VendorStatus.APPROVED:
        prod_status = ProductStatus.DRAFT

    product = Product(
        name=body.name,
        slug=_slugify(body.name),
        description=body.description,
        short_description=body.short_description,
        category_id=body.category_id,
        category=category,
        unit=body.unit,
        unit_value=body.unit_value,
        tags=body.tags or [],
        attributes=body.attributes or {},
        status=prod_status,
        created_by=current_user["user_id"],
    )
    db.add(product)
    await db.flush()

    if body.images:
        product.primary_image_url = body.images[0]
        for idx, img_url in enumerate(body.images):
            db_img = ProductImage(
                product_id=product.id,
                image_url=img_url,
                is_primary=(idx == 0),
                sort_order=idx
            )
            db.add(db_img)
        await db.flush()

    # Create default variant
    variant = ProductVariant(
        product_id=product.id,
        name=f"{body.unit_value} {body.unit}",
        unit_value=body.unit_value,
        unit=body.unit,
        is_default=True,
    )
    db.add(variant)
    await db.flush()

    # Create vendor-specific price
    price = ProductPrice(
        product_id=product.id,
        variant_id=variant.id,
        vendor_id=vendor.id,
        price=body.price,
        compare_at_price=body.compare_at_price,
    )
    db.add(price)

    # Create inventory entry
    inventory = Inventory(
        product_id=product.id,
        variant_id=variant.id,
        vendor_id=vendor.id,
        quantity=0,
        is_in_stock=True,
    )
    db.add(inventory)
    await db.flush()

    return APIResponse(success=True, message="Product created", data=ProductResponse.model_validate(product))


@router.get("/{product_id}", response_model=APIResponse[ProductResponse])
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get product details."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.variants), selectinload(Product.images), selectinload(Product.category))
        .where(Product.id == product_id, Product.is_deleted == False)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return APIResponse(success=True, data=ProductResponse.model_validate(product))


@router.patch("/{product_id}", response_model=APIResponse[ProductResponse])
async def update_product(
    product_id: UUID,
    body: ProductUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a product."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=403, detail="Vendor profile required")

    if body.status is not None and body.status == ProductStatus.ACTIVE:
        from app.models.vendor import VendorStatus
        if vendor.status != VendorStatus.APPROVED:
            raise HTTPException(
                status_code=403,
                detail="Your KYC verification is incomplete/pending. You can only save products as DRAFT."
            )

    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.images))
        .where(Product.id == product_id, Product.is_deleted == False)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in body.model_dump(exclude_unset=True, exclude={"price", "compare_at_price", "images"}).items():
        if hasattr(product, field) and value is not None:
            if field == "category_id":
                cat_res = await db.execute(select(Category).where(Category.id == value, Category.is_deleted == False))
                category = cat_res.scalars().first()
                if not category:
                    raise HTTPException(status_code=400, detail="Category not found")
                product.category = category
            setattr(product, field, value)

    # If the user is a vendor and passed price or compare_at_price, update ProductPrice
    if vendor and (body.price is not None or body.compare_at_price is not None):
        price_result = await db.execute(
            select(ProductPrice).where(
                ProductPrice.product_id == product.id,
                ProductPrice.vendor_id == vendor.id,
                ProductPrice.is_active == True
            )
        )
        price_obj = price_result.scalars().first()
        if price_obj:
            if body.price is not None:
                price_obj.price = body.price
            if body.compare_at_price is not None:
                price_obj.compare_at_price = body.compare_at_price
        else:
            price_obj = ProductPrice(
                product_id=product.id,
                vendor_id=vendor.id,
                price=body.price if body.price is not None else 30.0,
                compare_at_price=body.compare_at_price
            )
            db.add(price_obj)

    if body.images is not None:
        await db.execute(delete(ProductImage).where(ProductImage.product_id == product.id))
        if body.images:
            product.primary_image_url = body.images[0]
            for idx, img_url in enumerate(body.images):
                db_img = ProductImage(
                    product_id=product.id,
                    image_url=img_url,
                    is_primary=(idx == 0),
                    sort_order=idx
                )
                db.add(db_img)
        else:
            product.primary_image_url = None
        await db.flush()
        await db.refresh(product, attribute_names=["images"])

    product.updated_by = current_user["user_id"]
    await db.flush()
    return APIResponse(success=True, message="Product updated", data=ProductResponse.model_validate(product))


@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a product."""
    result = await db.execute(select(Product).where(Product.id == product_id, Product.is_deleted == False))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.soft_delete(current_user["user_id"])
    await db.flush()
    return APIResponse(success=True, message="Product deleted")


@router.post("/{product_id}/inventory", response_model=APIResponse)
async def update_inventory(
    product_id: UUID,
    quantity: float,
    change_type: str = "add",
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update product inventory."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=403, detail="Vendor required")

    inv_result = await db.execute(
        select(Inventory).where(Inventory.product_id == product_id, Inventory.vendor_id == vendor.id, Inventory.is_deleted == False)
    )
    inventory = inv_result.scalars().first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    old_qty = inventory.quantity
    if change_type == "add":
        inventory.quantity += quantity
    elif change_type == "remove":
        inventory.quantity = max(0, inventory.quantity - quantity)
    elif change_type == "set":
        inventory.quantity = quantity
    else:
        raise HTTPException(status_code=400, detail="change_type must be 'add', 'remove', or 'set'")

    inventory.is_in_stock = inventory.quantity > 0

    # Log the change
    log = InventoryLog(
        inventory_id=inventory.id,
        vendor_id=vendor.id,
        change_type=change_type,
        quantity_change=quantity,
        quantity_before=old_qty,
        quantity_after=inventory.quantity,
        reference_type="manual",
        notes=notes,
        created_by=current_user["user_id"],
    )
    db.add(log)
    await db.flush()

    return APIResponse(success=True, message=f"Inventory updated: {old_qty} → {inventory.quantity}")


@router.post("/bulk-import", response_model=APIResponse)
async def bulk_import_products(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import products from CSV file."""
    vendor = await Vendor.get_by_user_id(db, current_user["user_id"])
    if not vendor:
        raise HTTPException(status_code=403, detail="Vendor required")

    content = await file.read()
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    imported = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        try:
            name = row.get("name", "").strip()
            if not name:
                errors.append({"row": row_num, "error": "Name is required"})
                continue

            category_slug = row.get("category", "").strip()
            cat_result = await db.execute(select(Category).where(Category.slug == category_slug, Category.is_deleted == False))
            category = cat_result.scalars().first()
            if not category:
                errors.append({"row": row_num, "error": f"Category '{category_slug}' not found"})
                continue

            product = Product(
                name=name,
                slug=_slugify(name),
                description=row.get("description", ""),
                category_id=category.id,
                unit=row.get("unit", "kg"),
                unit_value=float(row.get("unit_value", 1)),
                status=ProductStatus.ACTIVE,
                created_by=current_user["user_id"],
            )
            db.add(product)
            await db.flush()

            price_val = float(row.get("price", 0))
            if price_val > 0:
                variant = ProductVariant(
                    product_id=product.id,
                    name=f"{product.unit_value} {product.unit}",
                    unit_value=product.unit_value,
                    unit=product.unit,
                    is_default=True,
                )
                db.add(variant)
                await db.flush()

                price = ProductPrice(product_id=product.id, variant_id=variant.id, vendor_id=vendor.id, price=price_val)
                db.add(price)

                inv = Inventory(product_id=product.id, variant_id=variant.id, vendor_id=vendor.id,
                               quantity=float(row.get("stock", 0)), is_in_stock=True)
                db.add(inv)

            imported += 1
        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})

    await db.flush()
    return APIResponse(success=True, message=f"Imported {imported} products", meta={"imported": imported, "errors": errors})


# ===== Categories =====

@router.get("/categories/tree", response_model=APIResponse[List[CategoryResponse]])
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    """Get full category tree."""
    result = await db.execute(
        select(Category)
        .where(Category.is_deleted == False, Category.is_active == True)
        .order_by(Category.level, Category.sort_order)
    )
    categories = result.scalars().all()
    return APIResponse(success=True, data=[CategoryResponse.model_validate(c) for c in categories])


@router.post("/categories", response_model=APIResponse[CategoryResponse], status_code=201)
async def create_category(
    body: CategoryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new category or subcategory."""
    # Generate unique slug
    slug = _slugify(body.name)
    existing = await db.execute(select(Category).where(Category.slug == slug, Category.is_deleted == False))
    if existing.scalars().first():
        import secrets
        slug = f"{slug}-{secrets.token_hex(2)}"

    level = 0
    if body.parent_id:
        parent_result = await db.execute(select(Category).where(Category.id == body.parent_id, Category.is_deleted == False))
        parent = parent_result.scalars().first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")
        level = parent.level + 1

    category = Category(
        name=body.name,
        slug=slug,
        description=body.description,
        icon=body.icon,
        image_url=body.image_url,
        parent_id=body.parent_id,
        level=level,
        sort_order=body.sort_order,
        is_active=body.is_active,
        created_by=current_user["user_id"],
    )
    db.add(category)
    await db.flush()
    return APIResponse(success=True, message="Category created successfully", data=CategoryResponse.model_validate(category))
