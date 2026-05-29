# Changelog

All notable changes to the **SabjiWala** platform will be documented in this file. 

This project and its version records are copyrighted by **Vikash kumar (@vikukumar)**. All Rights Reserved.

---

## [1.0.0] - 2026-05-29

First stable production-grade release of the SabjiWala eCommerce Platform.

### Added
- **Authentication**:
  - Google and Facebook social media login redirects and callback code exchanges.
  - Secure Email OTP passwordless login with resend countdowns and responsive HTML template layouts.
  - Route protection guards blocking dashboards if authorization is missing.
- **Unified Portal (`sabjiwala-web`)**:
  - Consolidated all dashboards (`/`, `/vendor`, `/delivery`, `/admin`) into a single Next.js project.
  - Configured `@sabjiwala/shared` and dependencies to resolve cleanly under Next.js Turbopack.
- **Versioning**:
  - Centralized version tracking inside root `version.json`.
  - Added build hooks (`prebuild` and `predev` scripts) to copy versions into individual apps dynamically.
- **GitHub CI/CD**:
  - Full GitHub Actions workflow in `.github/workflows/release.yml` compiling Docker backend, static web assets, signed Android APKs, and Simulator-ready iOS payloads.
