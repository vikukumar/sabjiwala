export type UserType = 'customer' | 'vendor' | 'delivery_boy' | 'admin' | 'super_admin' | 'support_agent';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  first_name: string;
  last_name: string;
  user_type: UserType;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
  referral_code?: string;
  mfa_enabled: boolean;
  created_at: string;
}

export interface UserAddress {
  id: string;
  label: string;
  full_name: string;
  phone?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  formatted_address?: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  status: 'pending' | 'documents_submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended' | 'deactivated';
  description?: string;
  logo_url?: string;
  average_rating: number;
  total_orders: number;
  commission_rate: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  category_id: string;
  unit: string;
  unit_value: number;
  primary_image_url?: string;
  status: 'active' | 'draft' | 'inactive';
  is_featured: boolean;
  tags?: string[];
  attributes?: Record<string, any>;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  level: number;
  is_active: boolean;
  sort_order: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  vendor_id: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Cart {
  id: string;
  vendor_id?: string;
  coupon_code?: string;
  items: CartItem[];
  subtotal: number;
  item_count: number;
}

export interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'accepted' | 'packed' | 'assigned' | 'picked' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | 'returned' | 'partial_refund' | 'failed';
  subtotal: number;
  delivery_charge: number;
  tax_amount: number;
  discount_amount: number;
  coupon_discount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  customer_notes?: string;
  estimated_delivery_time?: string;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  coupon_type: 'percentage' | 'fixed' | 'free_delivery' | 'buy_x_get_y' | 'referral';
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount: number;
  current_uses: number;
  max_total_uses?: number;
  is_active: boolean;
  starts_at: string;
  expires_at?: string;
}

export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  image_url?: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, any>[];
  meta?: Record<string, any>;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  meta?: Record<string, any>;
}
