"""
Standardized API response schemas used across all endpoints.
"""
from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field, computed_field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""
    success: bool = True
    message: str = ""
    data: Optional[T] = None
    errors: Optional[List[dict]] = None
    meta: Optional[dict] = None

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated API response."""
    success: bool = True
    message: str = ""
    data: List[T] = []
    pagination: "PaginationMeta"
    meta: Optional[dict] = None


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = 1
    page_size: int = 20
    total_items: int = 0
    total_pages: int = 0
    has_next: bool = False
    has_previous: bool = False


class ErrorResponse(BaseModel):
    """Error response."""
    success: bool = False
    message: str
    errors: Optional[List[dict]] = None
    error_code: Optional[str] = None


# ===== Auth Schemas =====

class RegisterRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field("", max_length=100)
    referral_code: Optional[str] = None
    device_id: Optional[str] = None
    role: Optional[str] = "customer"

    # Vendor-specific details
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    description: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    fssai_number: Optional[str] = None

    # Delivery-specific details
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    license_number: Optional[str] = None

class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    device_id: Optional[str] = None
    role: Optional[str] = None
    # E2EE payload fields
    encrypted_key: Optional[str] = None
    encrypted_payload: Optional[str] = None
    iv: Optional[str] = None
    tag: Optional[str] = None

class OTPLoginRequest(BaseModel):
    identifier: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    purpose: str = "login"

class OTPVerifyRequest(BaseModel):
    identifier: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    otp: Optional[str] = Field(None, min_length=6, max_length=6)
    purpose: str = "login"
    device_id: Optional[str] = None
    role: Optional[str] = None
    # E2EE payload fields
    encrypted_key: Optional[str] = None
    encrypted_payload: Optional[str] = None
    iv: Optional[str] = None
    tag: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900

class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: List[str]

class MFAVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)

# ===== Passkey (WebAuthn) Schemas =====

class PasskeyRegisterOptionsRequest(BaseModel):
    device_name: Optional[str] = None

class PasskeyRegisterOptionsResponse(BaseModel):
    challenge: str
    user: dict
    rp: dict

class PasskeyRegisterVerifyRequest(BaseModel):
    credential_id: str
    public_key_pem: str
    device_name: str

class PasskeyLoginOptionsRequest(BaseModel):
    identifier: str

class PasskeyLoginOptionsResponse(BaseModel):
    challenge: str
    allow_credentials: List[str]

class PasskeyLoginVerifyRequest(BaseModel):
    credential_id: str
    authenticator_data_b64: str
    client_data_json_b64: str
    signature_b64: str
    identifier: str
    device_id: Optional[str] = None
    role: Optional[str] = None

# ===== Magic Link Schemas =====

class MagicLinkRequest(BaseModel):
    identifier: str
    role: Optional[str] = "customer"

# ===== Password Reset Schemas =====

class PasswordResetRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class PasswordResetVerifyRequest(BaseModel):
    identifier: str
    otp: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


# ===== User Schemas =====

class UserResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: str
    last_name: str
    user_type: str
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    referral_code: Optional[str] = None
    mfa_enabled: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    language: Optional[str] = None
    bio: Optional[str] = None

class AddressCreate(BaseModel):
    label: str = "Home"
    full_name: str = ""
    phone: Optional[str] = None
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state: str
    country: str = "India"
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False
    place_id: Optional[str] = None

class AddressResponse(BaseModel):
    id: UUID
    label: str
    full_name: str
    phone: Optional[str] = None
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state: str
    country: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool
    formatted_address: Optional[str] = None
    place_id: Optional[str] = None

    class Config:
        from_attributes = True


# ===== Vendor Schemas =====

class VendorRegisterRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=300)
    business_type: str = "individual"
    description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    fssai_number: Optional[str] = None
    status: Optional[str] = None

class VendorResponse(BaseModel):
    id: UUID
    business_name: str
    slug: str
    status: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    average_rating: float
    total_orders: int
    commission_rate: float
    created_at: datetime

    class Config:
        from_attributes = True

class StoreTimingsUpdate(BaseModel):
    store_timings: dict  # {monday: {open: "09:00", close: "21:00", is_closed: false}, ...}

class ServiceAreaCreate(BaseModel):
    name: str = "Default"
    radius_km: Optional[float] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None
    polygon_geojson: Optional[dict] = None

class DeliveryRuleCreate(BaseModel):
    min_order_amount: float = 0.0
    free_delivery_above: Optional[float] = None
    base_delivery_charge: float = 0.0
    per_km_charge: float = 0.0
    max_delivery_distance_km: float = 10.0
    packaging_fee: float = 0.0
    free_platform_fee_above: Optional[float] = None
    distance_slabs: Optional[list] = None


# ===== Product Schemas =====

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: UUID
    unit: str = "kg"
    unit_value: float = 1.0
    price: float = Field(..., gt=0)
    compare_at_price: Optional[float] = None
    tags: Optional[List[str]] = None
    attributes: Optional[dict] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[UUID] = None
    unit: Optional[str] = None
    unit_value: Optional[float] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    attributes: Optional[dict] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: bool = True
    sort_order: int = 0


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[UUID] = None
    level: int
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: UUID
    category: Optional[CategoryResponse] = None
    unit: str
    unit_value: float
    primary_image_url: Optional[str] = None
    status: str
    is_featured: bool
    tags: Optional[List[str]] = None
    attributes: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Order Schemas =====

class CartItemAdd(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    quantity: float = 1.0

class CartItemUpdate(BaseModel):
    quantity: float

class CheckoutRequest(BaseModel):
    address_id: Optional[UUID] = None
    payment_method: str = "cod"  # cod, razorpay, phonepe, wallet
    coupon_code: Optional[str] = None
    customer_notes: Optional[str] = None
    use_wallet: bool = False
    wallet_amount: Optional[float] = None

class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    vendor_id: UUID
    product_name: str
    name: str = Field(validation_alias="product_name")
    variant_name: Optional[str] = None
    product_image_url: Optional[str] = None
    unit: str
    quantity: float
    unit_price: float
    total_price: float

    @computed_field
    @property
    def attributes(self) -> dict:
        return {"image_emoji": self.product_image_url or "🥬"}

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    status: str
    subtotal: float
    delivery_charge: float
    tax_amount: float
    discount_amount: float
    coupon_discount: float
    total_amount: float
    packaging_charge: float = 0.0
    payment_method: str
    payment_status: str
    customer_notes: Optional[str] = None
    estimated_delivery_time: Optional[datetime] = None
    created_at: datetime
    delivery_otp: Optional[str] = None
    delivery_agent: Optional[dict] = None
    items: Optional[List[OrderItemResponse]] = None
    vendor_store: Optional[dict] = None

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class ReturnRequestCreate(BaseModel):
    order_id: UUID
    reason: str
    images: Optional[List[str]] = None


# ===== Payment Schemas =====

class PaymentInitiate(BaseModel):
    order_id: UUID
    gateway: str  # razorpay, phonepe
    return_url: Optional[str] = None

class PaymentVerify(BaseModel):
    gateway: str
    gateway_order_id: str
    gateway_payment_id: str
    gateway_signature: Optional[str] = None

class WalletTopUp(BaseModel):
    amount: float = Field(..., gt=0)
    gateway: str = "razorpay"


# ===== Coupon Schemas =====

class CouponCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    name: str
    description: Optional[str] = None
    coupon_type: str  # percentage, fixed, free_delivery, buy_x_get_y, referral
    discount_value: float = 0.0
    max_discount_amount: Optional[float] = None
    min_order_amount: float = 0.0
    max_total_uses: Optional[int] = None
    max_uses_per_user: int = 1
    starts_at: datetime
    expires_at: Optional[datetime] = None
    rules: Optional[List[dict]] = None

class CouponApply(BaseModel):
    code: str
    cart_total: float
    vendor_id: Optional[UUID] = None
    category_ids: Optional[List[UUID]] = None
    product_ids: Optional[List[UUID]] = None

class CouponResponse(BaseModel):
    id: UUID
    code: str
    name: str
    coupon_type: str
    discount_value: float
    max_discount_amount: Optional[float] = None
    min_order_amount: float
    current_uses: int
    max_total_uses: Optional[int] = None
    is_active: bool
    starts_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== Notification Schemas =====

class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    body: str
    image_url: Optional[str] = None
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh_key: str
    auth_key: str
    device_type: Optional[str] = None


# ===== Support Schemas =====

class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=5, max_length=500)
    description: str
    category: str = "general"
    order_id: Optional[UUID] = None

class TicketMessageCreate(BaseModel):
    message: str
    attachments: Optional[List[str]] = None


# ===== Search Schemas =====

class SearchQuery(BaseModel):
    q: str = Field(..., min_length=1)
    category_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    sort_by: Optional[str] = None  # relevance, price_asc, price_desc, rating, distance
    page: int = 1
    page_size: int = 20


# ===== Admin Schemas =====

class InstallationStep(BaseModel):
    step: str
    data: dict

class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    value_json: Optional[dict] = None

class UpdateUserStatusRequest(BaseModel):
    is_active: bool

class UpdateUserRoleRequest(BaseModel):
    role: str

class UpdateVendorCommissionRequest(BaseModel):
    commission_rate: float
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    description: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    fssai_number: Optional[str] = None
    # Delivery rule fields
    min_order_amount: Optional[float] = None
    free_delivery_above: Optional[float] = None
    base_delivery_charge: Optional[float] = None
    per_km_charge: Optional[float] = None
    max_delivery_distance_km: Optional[float] = None
    packaging_fee: Optional[float] = None
    free_platform_fee_above: Optional[float] = None

class UpdateDeliveryBoyStatusRequest(BaseModel):
    status: str

class BannerCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: str
    mobile_image_url: Optional[str] = None
    action_url: Optional[str] = None
    action_type: Optional[str] = None
    position: str = "home_top"
    sort_order: int = 0
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

class CmsPageCreate(BaseModel):
    slug: str
    title: str
    content: str
    page_type: str = "custom"
    is_published: bool = False
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


# ===== Delivery Schemas =====

class DeliveryLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None

class DeliveryOTPVerify(BaseModel):
    order_id: UUID
    otp: str

class AvailabilityToggle(BaseModel):
    is_available: bool
