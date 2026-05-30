#!/bin/sh
set -e

# Setup defaults for env variables if they are not set
export CUSTOMER_DOMAIN="${CUSTOMER_DOMAIN:-customer.sbjiwala.local}"
export VENDOR_DOMAIN="${VENDOR_DOMAIN:-vendor.sbjiwala.local}"
export DELIVERY_DOMAIN="${DELIVERY_DOMAIN:-delivery.sbjiwala.local}"
export ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.sbjiwala.local}"
export API_DOMAIN="${API_DOMAIN:-api.sbjiwala.local}"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"

echo "Substituting environment variables in Nginx config template..."
envsubst '$CUSTOMER_DOMAIN $VENDOR_DOMAIN $DELIVERY_DOMAIN $ADMIN_DOMAIN $API_DOMAIN $BACKEND_URL' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

echo "Starting Sbjiwala Backend (FastAPI)..."
cd /app
# Start uvicorn on localhost port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 &

echo "Starting Sbjiwala Frontend (Nginx)..."
# Start Nginx in the foreground using the generated config file
nginx -c /tmp/nginx.conf -g "daemon off;"
