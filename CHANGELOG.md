# Changelog

All notable changes to the **Sbjiwala** platform will be documented in this file. 

This project and its version records are copyrighted by **Vikash kumar (@vikukumar)**. All Rights Reserved.

---

## [0.1.0] - 2026-05-29

First stable production-grade release of the Sbjiwala eCommerce Platform.

### Added
- **Authentication**:
  - Google and Facebook social media login redirects and callback code exchanges.
  - Secure Email OTP passwordless login with resend countdowns and responsive HTML template layouts.
  - Route protection guards blocking dashboards if authorization is missing.
- **Unified Portal (`sbjiwala-web`)**:
  - Consolidated all dashboards (`/`, `/vendor`, `/delivery`, `/admin`) into a single Next.js project.
  - Configured `@sbjiwala/shared` and dependencies to resolve cleanly under Next.js Turbopack.
- **Versioning**:
  - Centralized version tracking inside root `version.json`.
  - Added build hooks (`prebuild` and `predev` scripts) to copy versions into individual apps dynamically.
- **GitHub CI/CD**:
  - Full GitHub Actions workflow in `.github/workflows/release.yml` compiling Docker backend, static web assets, signed Android APKs, and Simulator-ready iOS payloads.
