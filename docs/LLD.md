# Low-Level Design (LLD) — Sbjiwala Premium Experience & Dispatch

This document details low-level software specifications, folder layout hierarchies, TypeScript hooks, and Python service functions.

---

## 1. Directory Tree & Component Hierarchy

### 1.1 Customer Onboarding & Permissions App Shell
- **File**: `apps/customer-app/src/components/AppShell.tsx`
- **Purpose**: Manages starting states, onboarding carousels, network connections, and contextual permissions.
- **State Properties**:
  - `isOnboarded` (boolean): Tracks if the customer has completed onboarding.
  - `onboardingStep` (number): Current active onboarding slide (1 to 4).
  - `location` (object): Latitude and longitude coordinates.
  - `networkStatus` (string): `online`, `offline`, `maintenance`, or `update_required`.
  - `permissionState` (object): Tracks Geolocation and Notification permissions.

### 1.2 Vendor KYC Page Form Layout
- **File**: `apps/vendor-app/src/app/kyc/page.tsx`
- **Purpose**: Implements steps for submitting owner data, address, license details, and file uploads.
- **State Properties**:
  - `step` (number): Tracks current active wizard screen (1 to 3).
  - `formData` (KYCFormData): Captures inputs for FSSAI, PAN, and GSTIN numbers.
  - `files` (object): Handles file binary state.
  - `uploadProgress` (object): Displays progress percentage for documents.

### 1.3 Super Admin Dossier Verification
- **File**: `apps/admin-app/src/app/users/vendors/[id]/verify/VerifyVendorClient.tsx`
- **Purpose**: Inspects registration fields, loads clickable certificates, and processes approvals/rejections.
- **State Properties**:
  - `rejectionReason` (string): Captures reasons for a rejected application.
  - `showRejectForm` (boolean): Controls display of the rejection feedback form.

---

## 2. Python Service Interfaces (FastAPI Backend)

### 2.1 Spatial Courier Selection Algorithm
- **File**: `apps/backend/app/services/delivery_assignment_service.py`
- **Core Function**: `find_best_delivery_boy(order_id: UUID) -> Optional[DeliveryBoy]`
- **Pseudo-Code Implementation**:
  ```python
  # 1. Fetch store coords
  order = db.query(Order).get(order_id)
  vendor = db.query(Vendor).get(order.vendor_id)
  store_lat, store_lon = vendor.store.latitude, vendor.store.longitude
  
  # 2. Check if the vendor has registered private couriers in the system
  has_private = db.query(DeliveryBoy).filter(
      DeliveryBoy.vendor_id == order.vendor_id, 
      DeliveryBoy.is_deleted == False
  ).exists()
  
  # 3. Restrict candidates based on courier association
  if has_private:
      # strictly private couriers
      candidates = db.query(DeliveryBoy).filter(
          DeliveryBoy.vendor_id == order.vendor_id,
          DeliveryBoy.status == "active",
          DeliveryBoy.availability.in_(["available", "on_delivery"]),
          DeliveryBoy.current_order_count < DeliveryBoy.max_concurrent_orders
      ).all()
  else:
      # public platform couriers only
      candidates = db.query(DeliveryBoy).filter(
          DeliveryBoy.vendor_id == None,
          DeliveryBoy.status == "active",
          DeliveryBoy.availability.in_(["available", "on_delivery"]),
          DeliveryBoy.current_order_count < DeliveryBoy.max_concurrent_orders
      ).all()
      
  if not candidates:
      return None
      
  # 4. Math matching - Haversine distance
  best_boy = min(candidates, key=lambda b: haversine(store_lat, store_lon, b.lat, b.lon))
  return best_boy
  ```

### 2.2 Dual Wallet Settlement
- **File**: `apps/backend/app/services/order_service.py`
- **Core Function**: `update_order_status(order_id: UUID, status: OrderStatus)`
- **Pseudo-Code Implementation**:
  ```python
  if status == OrderStatus.DELIVERED:
      # 1. Calculate base catalog rate (deduct customer 4.5% markup)
      base_catalog_subtotal = round(order.subtotal / 1.045, 2)
      
      # 2. Check courier status
      boy = db.query(DeliveryBoy).filter(DeliveryBoy.user_id == order.delivery_boy_id).first()
      is_public = (boy.vendor_id is None) if boy else True
      
      # 3. Settle public courier wallet
      if boy and is_public:
          rate = db.query(Setting).filter(key="delivery_boy_rate_per_km").first().value or 10.0
          payout = round(order.delivery_distance_km * rate, 2)
          
          wallet = db.query(DeliveryWallet).filter(boy_id=boy.id).first()
          wallet.balance += payout
          
      # 4. Settle vendor wallet (with base catalog rates minus public delivery charge if applicable)
      vendor_wallet = db.query(VendorWallet).filter(vendor_id=order.vendor_id).first()
      commission = base_catalog_subtotal * vendor.commission_rate
      vendor_earnings = base_catalog_subtotal - commission
      
      if is_public:
          vendor_earnings -= order.delivery_charge
          
      vendor_wallet.balance += vendor_earnings
  ```

---

## 3. CSS Resets & Breakpoints
To enforce zero horizontal scroll bleed and guarantee full responsiveness on narrow port widths, the layout utilizes standard reset rules inside `globals.css` stylesheets:
```css
html, body {
  max-width: 100vw;
  overflow-x: hidden;
  position: relative;
  box-sizing: border-box;
}

/* Safe-area Notch Overrides */
.safe-padding-top {
  padding-top: env(safe-area-inset-top, 0px);
}
.safe-padding-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```
All dashboards must support the following grid scale breakpoints:
- `320px` to `428px`: Mobile viewport. Left navigation bars collapse, burgers are rendered, and grids are limited to a single column block.
- `768px` to `1024px`: Tablet viewport. Double column layout displays, with side margins tightened.
- `1280px` and above: Desktop viewports. Fixed navigation sidebars are active beside main content zones.
