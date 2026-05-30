# Technical Requirements Document (TRD) — Sbjiwala Premium Experience & Dispatch

This document details the architectural, schema, and API specifications for guest sessions, permission management, local storage cart syncing, spatial queries, Razorpay standard overlays, and vendor KYC.

---

## 1. Technical Framework & System Configuration
- **Monorepo Engine**: Next.js 16 utilizing pure Turbopack compilers. Pure physical folder links at `node_modules/@sbjiwala/shared` mapping the common shared package.
- **Backend API**: FastAPI running asynchronous worker pools and SQLAlchemy async sessions connected to a PostgreSQL database.
- **Mobile Scaffold**: Capacitor 6 wrappers mapping built static exports (`output: "export"`) into Android/iOS native WebViews.

---

## 2. API Specifications & Payload Schemas

### 2.1 Vendor KYC Onboarding
- **Endpoint**: `PATCH /api/v1/vendors/me`
- **Request Body (Pydantic model: `VendorRegisterRequest`)**:
  ```json
  {
    "business_name": "Fresh Garden Veggies",
    "business_type": "individual",
    "description": "Premium organic sourcing",
    "contact_email": "store@freshgarden.com",
    "contact_phone": "+91 98765 43210",
    "gst_number": "27AAAAA1111A1Z1",
    "pan_number": "ABCDE1234F",
    "fssai_number": "12345678901234",
    "status": "documents_submitted"
  }
  ```
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "Profile updated",
    "data": {
      "id": "e4f8e6c2-bf72-4dbe-a1c6-d98c253bc1d4",
      "business_name": "Fresh Garden Veggies",
      "slug": "fresh-garden-veggies-a5b6c7",
      "status": "documents_submitted",
      "description": "Premium organic sourcing",
      "commission_rate": 0.05,
      "created_at": "2026-05-30T17:15:30Z"
    }
  }
  ```

### 2.2 Super Admin Dossier Verification
- **Endpoint**: `POST /api/v1/admin/vendors/{vendor_id}/verify`
- **Parameters**:
  - `status` (Query String, required): `approved` or `rejected`
  - `reason` (Query String, optional): Rejection feedback notes
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "Vendor status updated to approved",
    "data": null
  }
  ```

### 2.3 Delivery Profile & Wallet Metrics
- **Endpoint**: `GET /api/v1/delivery/me`
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "",
    "data": {
      "id": "b3e8c6c2-bf72-4dbe-a1c6-d98c253bc1d4",
      "user_id": "c1f8e6c2-bf72-4dbe-a1c6-d98c253bc1d4",
      "vendor_id": "e4f8e6c2-bf72-4dbe-a1c6-d98c253bc1d4",
      "status": "active",
      "availability": "available",
      "vehicle_type": "motorcycle",
      "vehicle_number": "MH-12-AB-1234",
      "wallet_balance": 150.00,
      "cash_in_hand": 350.00
    }
  }
  ```

---

## 3. Database Schemas & Structural DDL

```sql
-- 1. Vendors Status & KYC Columns
ALTER TABLE vendors ADD COLUMN gst_number VARCHAR(20) NULL;
ALTER TABLE vendors ADD COLUMN pan_number VARCHAR(15) NULL;
ALTER TABLE vendors ADD COLUMN fssai_number VARCHAR(20) NULL;
ALTER TABLE vendors ADD COLUMN status VARCHAR(30) DEFAULT 'pending' NOT NULL;
ALTER TABLE vendors ADD COLUMN rejection_reason TEXT NULL;

-- 2. Delivery Boy Vendor Assignment Linking
ALTER TABLE delivery_boys ADD COLUMN vendor_id UUID NULL REFERENCES vendors(id);
CREATE INDEX ix_delivery_boys_vendor_status ON delivery_boys(vendor_id, status, availability);

-- 3. System Settings Configuration for Logistics
INSERT INTO system_settings (key, value, description) 
VALUES ('delivery_boy_rate_per_km', '10.0', 'Amount credited to public delivery boy per km of distance');
```

---

## 4. Algorithms & Calculations

### 4.1 Spatial Haversine Distance
To query storefronts and filter listings strictly within a 10 km sphere:
$$d = 2R \arcsin \left( \sqrt{ \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right) } \right)$$
Where:
- $R = 6371\text{ km}$ (Earth radius).
- $\phi_1, \phi_2$ represent coordinates in radians.
- $\Delta \phi$ is difference in latitude radians.
- $\Delta \lambda$ is difference in longitude radians.

### 4.2 Dynamic Platform Product Markups
Customer subtotal calculations apply a secure 4.5% markup rounded to two decimal places:
```python
marked_up_price = round(base_catalog_price * 1.045, 2)
```

---

## 5. Razorpay In-App Payment Injection
During checkout transitions, the checkout engine mounts the standard overlay directly within the active DOM without triggering redirect exits:
```typescript
const script = document.createElement("script");
script.src = "https://checkout.razorpay.com/v1/checkout.js";
script.async = true;
script.onload = () => {
  const options = {
    key: razorpayKey,
    amount: orderAmount * 100, // paise
    currency: "INR",
    name: "Sbjiwala",
    order_id: gatewayOrderId,
    handler: function (response: any) {
      verifyPayment(response.razorpay_payment_id, response.razorpay_signature);
    },
    theme: { color: "#10b981" }
  };
  const rzp = new (window as any).Razorpay(options);
  rzp.open();
};
document.body.appendChild(script);
```
