# Pipeline API URL Configuration Guide

## Overview

The Sbjiwala CI/CD pipeline automatically injects the backend API URL into mobile and web app builds. This eliminates manual configuration and ensures all apps connect to the correct backend API.

---

## How It Works

### 1. **Workflow Input**
When you trigger a manual build (workflow_dispatch), you can provide:
- **`api_url`**: Backend API URL (e.g., `https://api.example.com/api/v1`)

### 2. **Automatic Configuration**
The pipeline automatically:
1. Reads the `api_url` input from the workflow trigger
2. Creates `.env.production` files in each app with `NEXT_PUBLIC_API_URL`
3. Passes it to `npm run build` via environment variable
4. Builds native APKs/AABs (Android) and IPAs (iOS) with the embedded URL
5. Creates web static export with the configured API URL

### 3. **Build Embedding**
- For **Next.js apps**: `NEXT_PUBLIC_API_URL` is embedded at build time
- The `ApiClient` in `shared/src/api-client/index.ts` reads this value
- Native apps (Capacitor) include the compiled JavaScript bundle with the API URL

---

## Triggering a Build with API URL

### Via GitHub Web UI

1. Go to **Actions** → **Build & Release Sbjiwala Platform**
2. Click **Run workflow** → **Workflow dispatch**
3. Enter the backend API URL:
   ```
   https://api.staging.example.com/api/v1
   or
   https://api.production.example.com/api/v1
   ```
4. Toggle **Build iOS** if needed (expensive, only when necessary)
5. Click **Run workflow**

### Via GitHub CLI

```bash
gh workflow run release.yml \
  -f api_url="https://api.example.com/api/v1" \
  -f build_ios=false
```

### Via curl (Advanced)

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_ORG/sbjiwala/actions/workflows/release.yml/dispatches \
  -d '{
    "ref":"main",
    "inputs":{
      "api_url":"https://api.example.com/api/v1",
      "build_ios":"false"
    }
  }'
```

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow Dispatch (Manual Trigger)       │
│ Input: api_url = "https://api.example.com/api/v1"      │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
    ┌─────────────┐             ┌──────────────┐
    │   Web App   │             │ Mobile Apps  │
    │ (Next.js)   │             │ (Capacitor)  │
    └──────┬──────┘             └──────┬───────┘
           │                           │
           │                           │
    ┌──────▼──────────────────────────▼─────────┐
    │ 1. Create .env.production                  │
    │    NEXT_PUBLIC_API_URL=<api_url>           │
    │ 2. Run: npm run build                      │
    │    (with NEXT_PUBLIC_API_URL env var)      │
    │ 3. Build embeds API URL in bundle          │
    └──────┬────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────┐
    │ Output Artifacts                          │
    │ ├─ Web Static ZIP                         │
    │ ├─ Android APK/AAB (Customer/Vendor/Del)  │
    │ └─ iOS IPA (Customer/Vendor/Del)          │
    └───────────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────┐
    │ GitHub Release                            │
    │ (All artifacts with API URL embedded)     │
    └───────────────────────────────────────────┘
```

---

## Example Scenarios

### Development/Staging Build

```bash
gh workflow run release.yml \
  -f api_url="https://api-staging.sbjiwala.dev/api/v1" \
  -f build_ios=false
```

**Result**:
- ✅ Android APKs/AABs built with staging API URL
- ⏭️ iOS skipped (save build time/cost)
- Apps automatically point to `https://api-staging.sbjiwala.dev/api/v1`

### Production Build (Full)

```bash
gh workflow run release.yml \
  -f api_url="https://api.sbjiwala.qzz.io/api/v1" \
  -f build_ios=true
```

**Result**:
- ✅ Docker containers pushed to GHCR
- ✅ Android APKs/AABs built with production API
- ✅ iOS IPAs built with production API
- ✅ All artifacts in GitHub Release

### Auto-Detection (No API URL)

If you trigger a regular **push to main** (no `api_url`):
```bash
git push origin main
```

**Result**:
- Apps use **auto-detection** logic:
  - Dev (port 3000): `http://localhost:8000/api/v1`
  - Emulator: `http://10.0.2.2/api/v1`
  - Production: Relative path `/api/v1`

---

## API URL Resolution Priority

Inside the built app, the `ApiClient` resolves the API URL in this order:

1. **localStorage `sw_api_base_url`** (highest priority - runtime override)
2. **NEXT_PUBLIC_API_URL** (embedded at build time from this pipeline)
3. **Auto-detection** (fallback for dev/emulator)

---

## Files Modified by Pipeline

For each app during build:

```
apps/customer-app/
├── .env.production          # Created with NEXT_PUBLIC_API_URL
├── src/app/                 # Built with embedded API URL
└── android/                 # APK/AAB with API URL in JS bundle

apps/vendor-app/
├── .env.production
├── src/app/
└── android/

apps/delivery-app/
├── .env.production
├── src/app/
└── android/

apps/sbjiwala-web/
├── .env.production
└── out/                     # Static HTML/JS with API URL
```

---

## Troubleshooting

### Apps still connect to wrong API?

1. **Check the workflow run output**:
   - Go to Actions → Build & Release → [Run #]
   - Verify `api_url` was passed correctly
   - Look for "API URL configured: ..." log messages

2. **Check app build logs**:
   ```
   [Build & Sync Customer App] → Logs
   Look for: NEXT_PUBLIC_API_URL=... in logs
   ```

3. **Verify .env.production was created**:
   - The pipeline should log: "API URL configured: {url}"

4. **Clear browser cache & localStorage**:
   - localStorage value `sw_api_base_url` might override the embedded value
   - Dev tools → Application → localStorage → search `sw_api_base_url`

5. **Check API URL format**:
   - Must include `/api/v1` at the end
   - ✅ `https://api.example.com/api/v1`
   - ❌ `https://api.example.com`

---

## Best Practices

1. **Use environment-specific URLs**:
   - Staging: `https://api-staging.example.com/api/v1`
   - Production: `https://api.example.com/api/v1`

2. **Document the API URL for each release**:
   - Add it in release notes
   - Update team wiki/README

3. **Test before production**:
   - Build staging version first
   - Verify all apps connect correctly
   - Then build production version

4. **Automate with branch rules**:
   - Push to `staging` branch → Auto-build with staging API
   - Push to `main` branch → Auto-build with production API
   - (Requires webhook/additional automation)

---

## Environment Variables Reference

| Variable | Where Set | Used For | Example |
|----------|-----------|----------|---------|
| `API_URL` | Workflow input | Pipeline temp variable | `https://api.example.com/api/v1` |
| `NEXT_PUBLIC_API_URL` | `.env.production` + npm build | Embedded in compiled app | Same as API_URL |
| `sw_api_base_url` | Browser localStorage (runtime) | Runtime override | User-configurable |

---

## Next Steps

1. **Commit release.yml changes** to your repository
2. **Test a manual build** with your staging API URL
3. **Verify apps connect** to the correct backend
4. **Set up automation** (optional):
   - Auto-build on main push → production API
   - Auto-build on release tags → specific API
5. **Document in team wiki** with API URLs for each environment
