#!/bin/sh
set -e

echo "Starting Sbjiwala Unified Server (FastAPI + Next.js UI) on port 8080..."
cd /app
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 4
