#!/bin/sh
set -e

# Setup defaults for env variables if they are not set
export CUSTOMER_DOMAIN="${CUSTOMER_DOMAIN:-customer.sabjiwala.local}"
export VENDOR_DOMAIN="${VENDOR_DOMAIN:-vendor.sabjiwala.local}"
export DELIVERY_DOMAIN="${DELIVERY_DOMAIN:-delivery.sabjiwala.local}"
export ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.sabjiwala.local}"
export API_DOMAIN="${API_DOMAIN:-api.sabjiwala.local}"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"

echo "Substituting environment variables in Nginx config template..."
envsubst '$CUSTOMER_DOMAIN $VENDOR_DOMAIN $DELIVERY_DOMAIN $ADMIN_DOMAIN $API_DOMAIN $BACKEND_URL' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf

echo "Starting SabjiWala Backend (FastAPI)..."
cd /app
# Start uvicorn on localhost port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 &

echo "Starting SabjiWala Frontend (Nginx)..."
# Start Nginx in the foreground using the generated config file
nginx -c /tmp/nginx.conf -g "daemon off;"
