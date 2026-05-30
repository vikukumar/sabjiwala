# High-Level Design (HLD) — Sbjiwala Platform Architecture

This document describes the high-level architecture, module relationships, operational workflows, and data orchestration strategies across the Sbjiwala Next.js monorepo and FastAPI backend.

---

## 1. System Context Diagram
The following context map showcases user interactions and data access pathways within the system boundary:

```mermaid
graph TD
    %% Roles
    Customer[("Customer App<br>(Guest & Authenticated)")]
    Vendor[("Vendor App<br>(Catalog & Pack)")]
    Delivery[("Delivery App<br>(Accept & Map)")]
    Admin[("Admin Dashboard<br>(Oversight & Verification)")]

    %% Services
    API_Gateway["API Layer (FastAPI Router)"]
    DB[("PostgreSQL DB<br>(Transactional Store)")]
    Storage["Local / Public Storage<br>(KYC Docs & Images)"]
    Razorpay_API["Razorpay Payment Gateway"]

    %% Connections
    Customer -->|Browse / Add / Pay| API_Gateway
    Vendor -->|Submit KYC / Pack| API_Gateway
    Delivery -->|Clock-in / Deliver| API_Gateway
    Admin -->|Verify KYC / System Settings| API_Gateway

    API_Gateway --> DB
    API_Gateway --> Storage
    API_Gateway --> Razorpay_API
```

---

## 2. Dynamic Operational Workflows

### 2.1 unauthenticated Guest to Secure Customer Conversion
This flowchart traces how a guest browser local cart is synced upon authenticated login:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Guest Customer
    participant App as Customer App (DOM)
    participant Local as sw_guest_cart (LocalStore)
    participant API as Backend API Service
    participant DB as PostgreSQL Database

    Customer->>App: Browse vegetables (Guest mode)
    Customer->>App: Add "Fresh Spinach" to cart
    App->>Local: Write item + marked-up price
    Customer->>App: Click checkout
    App->>App: Redirect to /login?redirect=/checkout
    Customer->>App: Submit login credentials
    App->>API: POST /api/v1/auth/login
    API-->>App: Return access_token
    App->>Local: Read sw_guest_cart items
    loop Sync Cart Items
        App->>API: POST /api/v1/cart/items (Item details)
        API->>DB: Write CartItem row
    end
    App->>Local: Clear sw_guest_cart cache
    App->>App: Redirect to /checkout (COD default selected)
```

### 2.2 Smart Dispatch & Wallet Settlement Payouts
This workflow traces order pickup assignment routing, showing private vs public courier dispatch and subsequent wallet calculations:

```mermaid
sequenceDiagram
    autonumber
    participant Vendor as Vendor Store
    participant API as Backend Order Engine
    participant Dispatch as Dispatch Service
    participant Courier as Assigned Delivery Boy
    participant Wallet as Wallet Engine

    Vendor->>API: Mark Order as PACKED
    API->>Dispatch: Trigger find_best_delivery_boy
    alt Vendor has registered Private Couriers
        Dispatch->>Dispatch: Limit search strictly to vendor_id == store_id
        Dispatch->>Courier: Assign to nearest available private agent
    else Vendor uses Platform Couriers
        Dispatch->>Dispatch: Query public agents where vendor_id is NULL
        Dispatch->>Courier: Assign to nearest available public agent
    end
    
    Courier->>API: Submit Delivery OTP (Order DELIVERED)
    API->>Wallet: Trigger order completion settlement
    
    alt Private Courier Completed Order
        Wallet->>Wallet: Credit Vendor exactly base catalog price (No fees deducted)
        Wallet->>Wallet: Skip delivery boy wallet credits (Settled offline)
    else Public Platform Courier Completed Order
        Wallet->>Wallet: Calculate delivery boy credit (distance * rate_per_km)
        Wallet->>Wallet: Deduct delivery boy credit from vendor subtotal
        Wallet->>Wallet: Settle remaining vendor earnings in VendorWallet
    end
```

---

## 3. Core Architectural Modules

### 3.1 Next.js 16 Web Apps Scaffold
- **`customer-app`**: Customer storefront. Enables guest browsing, features location onboarding, contextual permissions, network monitoring overlays, COD selections, and inline Razorpay modals.
- **`vendor-app`**: Store owner hub. Provides store performance metrics, inventory checklists, active order packaging buttons, and step-by-step PAN/FSSAI document KYC submission forms.
- **`delivery-app`**: Mobile courier workspace. Contains availability status toggles, task location maps, OTP confirmation verification codes, and wallet payout metrics (hidden for private agents).
- **`admin-app`**: Corporate admin console. Manages system settings (including global courier km payout rates), catalog settings, database schemas, and pending KYC verification sheets.

### 3.2 Backend Service Layers
- **Analytics Service**: Computes performance indices, aggregates sales totals, and returns metrics for vendor dashboards and admin centers.
- **Delivery Assignment Service**: Handles spatial geofencing lookups and matches dispatch requests with close couriers.
- **Order Service**: Coordinates calculations (applying marked-up prices), writes inventory audits, and dispatches completion settlements.
- **Payment Service**: Processes Razorpay standard transactions, checks payment signatures, and performs wallet transfers.
