"""
Search Service using PostgreSQL Full-Text Search.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy import select, update, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.search import SearchIndex, GeoCache
from app.models.product import Product, Category, ProductPrice
from app.models.vendor import Vendor


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def index_product(self, product_id: UUID) -> None:
        """
        Build or update the search index document for a single product.
        """
        # Fetch product details
        res = await self.db.execute(
            select(Product)
            .where(Product.id == product_id, Product.is_deleted == False)
        )
        product = res.scalars().first()
        if not product:
            return

        # Fetch Category
        cat_res = await self.db.execute(
            select(Category).where(Category.id == product.category_id)
        )
        category = cat_res.scalars().first()
        category_name = category.name if category else ""

        # Fetch vendor prices for location indexing/metadata
        price_res = await self.db.execute(
            select(ProductPrice).where(ProductPrice.product_id == product_id, ProductPrice.is_deleted == False)
        )
        prices = price_res.scalars().all()
        
        # Compile content
        tags_str = " ".join(product.tags or [])
        content_parts = [
            product.name,
            product.description or "",
            product.short_description or "",
            category_name,
            tags_str
        ]
        content_text = " ".join(filter(None, content_parts))

        # Check existing index
        index_res = await self.db.execute(
            select(SearchIndex).where(
                SearchIndex.entity_type == "product",
                SearchIndex.entity_id == product_id,
                SearchIndex.is_deleted == False
            )
        )
        search_idx = index_res.scalars().first()

        meta = {
            "category_id": str(product.category_id),
            "category_name": category_name,
            "unit": product.unit,
            "unit_value": product.unit_value,
            "slug": product.slug,
            "prices": [{"vendor_id": str(p.vendor_id), "price": float(p.price)} for p in prices],
        }

        if search_idx:
            search_idx.title = product.name
            search_idx.content = content_text
            search_idx.metadata_json = meta
            search_idx.image_url = product.primary_image_url
            search_idx.last_indexed_at = datetime.now(timezone.utc)
        else:
            search_idx = SearchIndex(
                entity_type="product",
                entity_id=product_id,
                title=product.name,
                content=content_text,
                boost=1.0,
                metadata_json=meta,
                image_url=product.primary_image_url,
            )
            self.db.add(search_idx)

        await self.db.flush()

        # Update the tsvector search_vector column via raw execute since it is database specific
        # We can construct the vector from title and content
        await self.db.execute(
            text(
                "UPDATE search_index SET search_vector = "
                "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
                "setweight(to_tsvector('english', coalesce(content, '')), 'B') "
                "WHERE id = :id"
            ),
            {"id": search_idx.id}
        )

    async def search(
        self,
        query_str: str,
        category_id: Optional[UUID] = None,
        vendor_id: Optional[UUID] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Execute full-text search against the index.
        """
        if not query_str.strip():
            return []

        # Build raw tsquery
        # Format words to match prefix for auto-complete (e.g. 'appl:*')
        words = [f"{w.strip()}:*" for w in query_str.replace("'", "").split() if w.strip()]
        tsquery_str = " & ".join(words)

        # Base query selecting match rank using pg ts_rank_cd
        sql = (
            "SELECT entity_id, entity_type, title, image_url, metadata_json, "
            "ts_rank_cd(search_vector, to_tsquery('english', :tsquery)) AS rank "
            "FROM search_index "
            "WHERE search_vector @@ to_tsquery('english', :tsquery) AND is_deleted = false"
        )

        params: Dict[str, Any] = {"tsquery": tsquery_str, "limit": limit, "offset": offset}

        if category_id:
            sql += " AND (metadata_json->>'category_id' = :category_id)"
            params["category_id"] = str(category_id)

        # Filter by vendor ID if product matches the vendor price list
        if vendor_id:
            sql += " AND EXISTS (SELECT 1 FROM jsonb_to_recordset(metadata_json->'prices') as x(vendor_id text, price numeric) WHERE x.vendor_id = :vendor_id)"
            params["vendor_id"] = str(vendor_id)

        sql += " ORDER BY rank DESC, boost DESC LIMIT :limit OFFSET :offset"

        result = await self.db.execute(text(sql), params)
        rows = result.fetchall()

        results_list = []
        for row in rows:
            results_list.append({
                "id": str(row[0]),
                "type": row[1],
                "title": row[2],
                "image_url": row[3],
                "metadata": row[4],
                "rank": float(row[5]),
            })

        return results_list

    async def index_all_products(self) -> int:
        """
        Index all products in the database.
        """
        res = await self.db.execute(select(Product.id).where(Product.is_deleted == False))
        product_ids = res.scalars().all()
        for pid in product_ids:
            await self.index_product(pid)
        return len(product_ids)
