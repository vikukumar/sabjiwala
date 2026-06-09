# Sbjiwala — Complete Multi-Tenant Vegetable Commerce Platform

Sbjiwala is a complete, production-ready, multi-tenant vegetable commerce platform. It integrates a live catalog, cart and checkouts, vendor order processing, delivery agent tracking with OTP validation, and admin oversight. 

## Copyright & Ownership

> [!WARNING]
> **Proprietary Software Notice**
>
> This codebase, including all backend logic, database designs, frontends, configurations, and mobile integrations, is the sole proprietary property of **Vikash kumar (@vikukumar)**.
>
> **Copyright (c) 2026 Vikash kumar (vikukumar). All Rights Reserved.**
> 
> Any unauthorized copying, distribution, modification, sharing, or reuse of this software constitutes a direct copyright violation and is strictly prohibited by law. Violators will face immediate legal action.

---

## 🛠️ Technology Stack

### Backend
- **Core Framework**: Python 3.14+ & FastAPI
- **Database**: PostgreSQL (SQLAlchemy 2.x ORM)
- **Task Queue & Cache**: Redis & Celery
- **Authentication**: JWT, Email OTP verification, Google & Facebook OAuth 2.0

### Frontend & Mobile
- **Core Framework**: Next.js 16+ & React 19 (TypeScript)
- **Styling**: Tailwind CSS & CSS Variables
- **State & Data**: TanStack Query (React Query) & Zustand
- **Native Wrappers**: Capacitor CLI (compiling to signed Android and iOS native viewports)

---

## 📂 Project Directory Structure

```
sbjiwala.qzz.io/
├── .github/
│   └── workflows/
│       └── release.yml         # Unified CI/CD build & release pipeline
├── apps/
│   ├── backend/                # FastAPI application
│   ├── customer-app/           # Next.js customer commerce application
│   ├── vendor-app/             # Next.js vendor dashboard
│   ├── delivery-app/           # Next.js delivery agent dashboard
│   ├── admin-app/              # Next.js platform admin dashboard
│   └── sbjiwala-web/          # Unified portal serving all apps based on path
├── shared/                     # Shared TypeScript API clients and types
├── infrastructure/
│   ├── docker/                 # Production-grade Dockerfiles
│   └── nginx/                  # Nginx proxy routing configuration
├── version.json                # Single source-of-truth version file
├── LICENSE                     # Copyright license for Vikash kumar
└── README.md                   # This project overview
```

---

## 🚀 Running Locally

### 1. Prerequisites
- Docker & Docker Compose
- Node.js v20+ & npm
- Python 3.13+

### 2. Startup Backend
Spin up the database and caching layer:
```bash
docker-compose up -d postgres redis
```

Navigate to backend, install dependencies, and run:
```bash
cd apps/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Startup Web Portal
Navigate to the unified portal directory, install dependencies, and start:
```bash
cd apps/sbjiwala-web
npm install
npm run dev
```
Open `http://localhost:3000` in your browser. Navigating to the following paths redirects to the protected dashboards:
- `/` — Customer App Portal
- `/vendor` — Vendor Dashboard
- `/delivery` — Delivery Dashboard
- `/admin` — Admin Dashboard
- `/login` — Shared Secure Login Portal (Email OTP, Social redirects, and Developer Bypass)

---

## 📦 Deployment & Releases

Releases are fully automated via GitHub Actions:
1. Increment the version string in `version.json` (e.g. `"version": "1.0.0"`).
2. Create and push a git tag matching the version (e.g. `git tag v1.0.0 && git push origin v1.0.0`).
3. The workflow compiles the backend Docker image tarball, static web assets, signed Android APKs, and simulator-ready iOS payloads, then uploads them to a newly drafted GitHub Release.
