#!/bin/sh
set -e

echo "Starting SabjiWala Backend (FastAPI)..."
cd /app
# Start uvicorn on localhost port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 &

echo "Starting SabjiWala Frontend (Nginx)..."
# Start Nginx in the foreground
nginx -g "daemon off;"
