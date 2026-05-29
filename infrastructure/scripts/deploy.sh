#!/usr/bin/env bash
# Platform deployment script
set -e

echo "Deploying SabjiWala Platform..."
docker compose down
docker compose up --build -d
echo "Deployment completed successfully."
