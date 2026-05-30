#!/usr/bin/env bash
# Database Initialization Script
set -e

echo "Initializing database..."
docker compose exec postgres psql -U postgres -d postgres -c "CREATE DATABASE sbjiwala;" || echo "Database already exists"
echo "Database initialized."
