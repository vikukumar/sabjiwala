# System Architecture Document — Sbjiwala Monorepo

This document details the system architecture, infrastructure scaling patterns, local container definitions, and compile-time compilation details of the Sbjiwala platform.

---

## 1. Monorepo Physical Architecture
The platform is organized in a single monorepo to maximize code reuse, sharing assets, types, schemas, and configurations across services:

```
sabjiwala/
├── apps/
│   ├── customer-app/    # Customer PWA Next.js Webapp
│   ├── vendor-app/      # Store Manager Next.js Webapp
│   ├── admin-app/       # Corporate Oversight Next.js Webapp
│   ├── delivery-app/    # Courier Mobile Next.js Webapp
│   ├── sbjiwala-web/    # Public Landing Page & Re-routed Router
│   └── backend/         # FastAPI REST Backend App
├── shared/              # Common Types, hooks, and REST Client API
├── logo&icons/          # Master Brand Logos & Launcher Icons
├── version.json         # Unified system version manifest
└── package.json         # Workspaces script registry
```

---

## 2. Docker & Container Scaffolding
Infrastructure services and applications compile under separate container environments to separate scalability:

### 2.1 Backend Containerization (`Dockerfile.backend`)
- Utilizes PEP 517 build systems, copying packages before launching execution builds to preserve cache layers.
- Runs unprivileged un-routed processes to secure isolation.

### 2.2 Reverse Proxy Server Routing (`nginx.conf`)
- Runs on non-privileged unprivileged ports (`8080` for HTTP, `8443` for HTTPS) to enable non-root execution inside Docker containers.
- Maps paths as follows:
  - `/api` requests are re-routed to the FastAPI backend service (`http://backend:8000`).
  - Web applications are served under separate domain names or re-routed ports.

---

## 3. Database Scaling & Task Queues
- **PostgreSQL**: Implements connection pools, connection recycling, and disabled JIT in async queries to guarantee connection stability under heavy load.
- **Redis Cache**: Acts as the Celery asynchronous worker message broker and caching layer.
- **Celery Worker Package**: Manages background asynchronous processes (referrals, wallet payouts, invoice generators, SMS OTP dispatches) via workers connecting to the Redis queue.

---

## 4. Next.js 16 Pure Turbopack Compilations
- **Turbopack Compiler**: All five Next.js web applications are configured to compile using Turbopack engines, removing legacy Webpack configurations.
- **Physical Shared Link**: Works around Windows filesystem boundary limitations by copying physical files instead of NPM sibling symlinks.
- **Static Compilations**: Generates clean static parameter values on dynamic routes via `generateStaticParams()` to allow full HTML export builds.
