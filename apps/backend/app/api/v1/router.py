"""
API v1 Router — aggregates all domain routers.
"""
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.vendors import router as vendors_router
from app.api.v1.endpoints.products import router as products_router
from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.cart import router as cart_router
from app.api.v1.endpoints.wishlist import router as wishlist_router
from app.api.v1.endpoints.orders import router as orders_router
from app.api.v1.endpoints.payments import router as payments_router
from app.api.v1.endpoints.coupons import router as coupons_router
from app.api.v1.endpoints.offers import router as offers_router
from app.api.v1.endpoints.delivery import router as delivery_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.support import router as support_router
from app.api.v1.endpoints.search import router as search_router
from app.api.v1.endpoints.storage import router as storage_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.installation import router as installation_router
from app.api.v1.endpoints.maps import router as maps_router
from app.api.v1.endpoints.wallets import router as wallets_router
from app.api.v1.endpoints.reviews import router as reviews_router
from app.api.v1.endpoints.pages import router as pages_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.system import router as system_router

api_router = APIRouter()

api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(system_router, prefix="/system", tags=["System"])
api_router.include_router(installation_router, prefix="/installation", tags=["Installation"])
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(vendors_router, prefix="/vendors", tags=["Vendors"])
api_router.include_router(products_router, prefix="/products", tags=["Products"])
api_router.include_router(catalog_router, prefix="/catalog", tags=["Catalog"])
api_router.include_router(cart_router, prefix="/cart", tags=["Cart"])
api_router.include_router(wishlist_router, prefix="/wishlist", tags=["Wishlist"])
api_router.include_router(orders_router, prefix="/orders", tags=["Orders"])
api_router.include_router(payments_router, prefix="/payments", tags=["Payments"])
api_router.include_router(coupons_router, prefix="/coupons", tags=["Coupons"])
api_router.include_router(offers_router, prefix="/offers", tags=["Offers"])
api_router.include_router(delivery_router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(support_router, prefix="/support", tags=["Support"])
api_router.include_router(search_router, prefix="/search", tags=["Search"])
api_router.include_router(storage_router, prefix="/storage", tags=["Storage"])
api_router.include_router(maps_router, prefix="/maps", tags=["Maps"])
api_router.include_router(wallets_router, prefix="/wallets", tags=["Wallets"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["Reviews"])
api_router.include_router(pages_router, prefix="/pages", tags=["CMS Pages"])
api_router.include_router(chat_router, prefix="/chat", tags=["Live Chat"])
