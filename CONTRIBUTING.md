# Contributing to SabjiWala.in

Thank you for your interest in contributing to SabjiWala.in! 

## Copyright & IP Assignment Notice

> [!IMPORTANT]
> **Proprietary Project Rules**
>
> This codebase is proprietary software owned by **Vikash kumar (@vikukumar)**. All contributions (code, designs, documentation) submitted to this repository will immediately and irrevocably assign all intellectual property rights and copyrights to **Vikash kumar**. 
>
> Unauthorized contributions or distribution are strictly prohibited. By submitting a pull request, issue, or code change, you agree to assign all rights to the owner.

---

## 🛠️ Contribution Guidelines (Authorized Internal Collaborators Only)

As this is a private, proprietary codebase, contributions are restricted to authorized internal team members. Please follow these rules:

### 1. Branch Naming Conventions
- Features: `feature/name-of-feature`
- Fixes: `bugfix/issue-name`
- Refactor: `refactor/component-name`
- Version Bumps: `release/vX.Y.Z`

### 2. Code Quality & Formatting
- **Backend (Python)**:
  - Format using `black` or `ruff`.
  - Maintain type annotations for all FastAPI routers, schemas, and database service layers.
- **Frontend (TypeScript)**:
  - Run type checks (`npm run build` or `tsc --noEmit`) before proposing changes.
  - Follow React 19 and Next.js 16 structural paradigms.
  - Use clean Tailwind classes and custom CSS variables for dark/light mode thematic rules.

### 3. Submitting Pull Requests
1. Increment the version code in `version.json` if releasing new builds.
2. Verify that local builds (`npm run build` inside `apps/sabjiwala-web`) compile successfully.
3. Open a detailed Pull Request detailing the changes, testing checklist, and validation logs.
