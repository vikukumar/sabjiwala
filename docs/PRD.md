# Product Requirements Document (PRD) — Sbjiwala Premium Experience & Smart Dispatch

This document details the functional and non-functional product requirements for the Sbjiwala platform, covering unauthenticated guest access, start-up onboarding, permission triggers, network resilience overlays, integrated payment options, KYC dashboards, and delivery courier assignment routing.

---

## 1. Executive Summary & Business Goals
The Sbjiwala platform connects customers with hyper-local vendors for fast vegetable delivery. Key business priorities:
- Maximizing conversions by allowing guests to browse, search, and load items into carts before forcing registration.
- Elevating starting user confidence through onboarding slides explaining benefits, delivery, and contextual permission prompts.
- Optimizing logistics through smart courier dispatch prioritizations, distinguishing between private vendor couriers and public platform agents.
- Securing a sustainable monetization stream via a secure 4.5% customer markup delta while settling vendors exactly their listed catalog base rates.

---

## 2. Guest Catalog Browsing & Onboarding Experience
### 2.1 unauthenticated Guest Flows
- **Public Entry**: Customers must be able to open the application, view the category directory, browse products, search, and view vendor details without logging in.
- **Local Storage Cart**: Guest cart additions must be saved locally (using client-side caches like `sw_guest_cart`). Guests can modify item quantities (add/subtract) or remove items entirely inside the cart drawer.
- **Login Gate**: Clicking checkout while unauthenticated redirects the guest to `/login?redirect=/checkout`.
- **Automatic Cart Syncing**: Upon successful registration or login, the locally cached guest cart items must automatically synchronize with the server-side PostgreSQL cart database, ensuring zero loss of cart state.

### 2.2 First-Launch Onboarding Carousel
Upon first launch (determined via `sw_onboarded` cache state), a high-fidelity 4-slide start-up overlay is rendered:
- **Slide 1: Welcome**: Introduces the Sbjiwala brand and standard freshness commitments.
- **Slide 2: Location Benefits**: Details micro-hub coverage, highlighting the speed and efficiency of hyper-local deliveries.
- **Slide 3: Delivery Commitment**: Highlights standard farm fresh sourcing and lightning-fast delivery guarantees.
- **Slide 4: Location Setup**: Requests device geolocation permissions.
  - *If Granted*: Automatically updates customer coordinates, checks vendor hubs within a 10 km haversine radius, and displays local storefront catalogs.
  - *If Denied*: Displays a manual Location Picker drawer showcasing default active city hubs (Vashi, Thane, Bandra, Powai).

---

## 3. Contextual Permission Management
To optimize onboarding conversion rates, permissions are requested contextually rather than all at startup:
- **Geolocation Permission**: Triggered strictly on Slide 4 of the onboarding splash or when manually setting/updating the delivery address.
- **Push Notification Permission**: Triggered strictly after the first cart addition, user registration, or order checkout completion. Preceded by an explanatory card outlining push notification benefits (e.g. delivery tracking, dispatch updates).
- **Camera & Storage Permission**: Triggered strictly when uploading FSSAI certificates, GSTIN forms, and PAN details during vendor KYC onboarding, updating profile avatars, or submitting support ticket attachments.

---

## 4. Network Status & Connectivity Manager
The application monitors network connectivity continuously, polling a dedicated `/health` endpoint every 30 seconds. In the event of interruptions, the app renders full-screen overlays:
- **Offline Overlay**: Triggered when the browser goes offline (`navigator.onLine === false`) or endpoint requests fail continuously. Displays a descriptive message and a retry button.
- **Maintenance Overlay**: Triggered if the backend health check returns status indicators indicating restocking windows or system maintenance.
- **Forced Update Overlay**: Triggered when a discrepancy is detected between the local client build and the server's minimum supported version (defined in `version.json`), displaying a block page directing users to update their mobile wraps.

---

## 5. Seamless Payments & Razorpay Integration
### 5.1 Cash on Delivery (COD) Defaults
- Cash on Delivery (COD) is selected as the default payment option during checkout to reduce payment friction.
- Wallet payments are fully supported, enabling users to pay with their active digital balance when it covers the full order total.

### 5.2 In-App Razorpay SDK Overlay
- Online payments are processed via Razorpay. Clicking "Pay Online" dynamically injects the Razorpay Standard Checkout SDK (`checkout.js`) into the page head.
- The payment modal opens directly within the application viewport (web views/Capacitor shells) to prevent external browser exits.
- Captured payment signatures, order IDs, and transaction identifiers are sent to `/payments/verify` on success.

---

## 6. Vendor KYC & Admin Verification Dossiers
### 6.1 Vendor Onboarding Portal
Vendors can access a dedicated step-by-step KYC page `/kyc` to enter and upload:
- **Business Details**: Store Name, Contact Email, Contact Phone, and Business Structure.
- **Credentials**: PAN Card Number, FSSAI Registration Number, and optional GSTIN.
- **Document Scans**: Scan uploads for FSSAI certificates and PAN cards, utilizing real-time progress indicators. Submitting updates their profile state to `"documents_submitted"`.

### 6.2 Admin Review Dashboard
Admin officers can review outstanding vendor requests at `/users/vendors/[id]/verify`, showing:
- Business details, tax codes, and clickable certificate file links.
- **Approval Action**: Calls verify endpoints to mark the vendor as `"approved"` and verify their parent profile.
- **Rejection Action**: Provides a textarea input to specify feedback notes and records the status as `"rejected"`.

---

## 7. Smart Spatial Dispatch & Settling Rules
- **Haversine Distance Filter**: Customer storefronts display products and vendors located within a 10 km spherical radius of their coordinates.
- **Private Courier Prioritization**: If a vendor registers private delivery boys, orders from that vendor are assigned strictly to those private agents. External public platform agents are never dispatched for these stores.
- **Dynamic Public Courier Payouts**: Public delivery agents receive automated wallet payouts based on delivery distance (`distance_km * rate_per_km`).
- **Fee Exemptions for Private Agents**: Private delivery boys do not receive system wallet credits (handled offline). They do not have wallet metrics displayed on their dashboard. Vendors using private agents are exempt from delivery fee deductions.
