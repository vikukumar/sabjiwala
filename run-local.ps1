# ==============================================================================
# Sbjiwala Platform Local Startup Manager
# ==============================================================================
# This script orchestrates and starts all local services, database/redis
# containers, FastAPI backend, and Next.js web applications in separate consoles.
# ==============================================================================

# Ensure execution in the project root directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "           Sbjiwala Local Startup Manager           " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Check for Docker installation
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[WARNING] Docker is not installed or not in PATH." -ForegroundColor Yellow
    Write-Host "Please start PostgreSQL and Redis manually." -ForegroundColor Yellow
} else {
    Write-Host "[1/4] Starting PostgreSQL and Redis containers..." -ForegroundColor Green
    docker-compose up -d postgres redis
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to start Docker containers." -ForegroundColor Red
        exit 1
    }
    Write-Host "Database and Redis layers are healthy and running." -ForegroundColor Green
}

# Run physical dependency syncing to bypass Windows symlink boundaries
Write-Host "`n[2/4] Syncing shared workspace modules..." -ForegroundColor Green
if (Test-Path "fix_node_modules.py") {
    python fix_node_modules.py
} elseif (Test-Path "tmp/fix_node_modules.py") {
    python tmp/fix_node_modules.py
} else {
    Write-Host "Shared modules fixer script not found; skipping." -ForegroundColor Yellow
}

# Prompt user for execution mode
Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "Select Execution Mode:" -ForegroundColor Cyan
Write-Host " [1] Consolidated Portal Stack (Backend + Unified Web App) (Recommended)" -ForegroundColor Gray
Write-Host " [2] Complete Multi-App Suite (Backend + Customer + Vendor + Delivery + Admin)" -ForegroundColor Gray
Write-Host " [3] Shutdown all Docker containers and clean up" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan
$choice = Read-Host "Enter option [1-3] (Default: 1)"
if (-not $choice) { $choice = "1" }

if ($choice -eq "3") {
    Write-Host "`n[+] Stopping docker containers..." -ForegroundColor Green
    docker-compose down
    Write-Host "All local database and redis containers stopped." -ForegroundColor Green
    exit 0
}

# [3/4] Launching FastAPI Backend Service
Write-Host "`n[3/4] Launching FastAPI Backend Service..." -ForegroundColor Green
$backendCmd = ""
if (Test-Path "apps/backend/.venv") {
    # Activate virtual environment
    $backendCmd = "cd apps/backend; .\\.venv\\Scripts\\activate; python -m uvicorn app.main:app --reload --port 8000"
} else {
    # Run globally
    $backendCmd = "cd apps/backend; python -m uvicorn app.main:app --reload --port 8000"
}

Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala FastAPI Backend (Port 8000)'; $backendCmd"

# [4/4] Launching Next.js Web Portals
Write-Host "`n[4/4] Launching Next.js Web Portals..." -ForegroundColor Green

if ($choice -eq "1") {
    Write-Host "Starting Unified Web Portal at http://localhost:3000..." -ForegroundColor Green
    $webCmd = "cd apps/sbjiwala-web; npm run dev"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala Unified Web App (Port 3000)'; $webCmd"
} else {
    Write-Host "Starting all 4 Frontend Portals in parallel..." -ForegroundColor Green

    # Customer App (Port 3000)
    $customerCmd = "cd apps/customer-app; npm run dev -- -p 3000"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala Customer Portal (Port 3000)'; $customerCmd"

    # Vendor Dashboard (Port 3001)
    $vendorCmd = "cd apps/vendor-app; npm run dev -- -p 3001"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala Vendor Dashboard (Port 3001)'; $vendorCmd"

    # Delivery Dashboard (Port 3002)
    $deliveryCmd = "cd apps/delivery-app; npm run dev -- -p 3002"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala Courier App (Port 3002)'; $deliveryCmd"

    # Super Admin Dashboard (Port 3003)
    $adminCmd = "cd apps/admin-app; npm run dev -- -p 3003"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Sbjiwala Admin Oversight (Port 3003)'; $adminCmd"
}

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "    All services have been spawned successfully!     " -ForegroundColor Green
Write-Host "    Press Ctrl+C in individual windows to stop.      " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
