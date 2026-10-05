#!/usr/bin/env bash
set -e

echo "=== Starting AquaSentinel Development Environment ==="

# Build shared types first
npm run build --workspace=shared

# Start backend and frontend concurrently
npx concurrently \
  -n "backend,frontend" \
  -c "blue,cyan" \
  "npm run dev --workspace=backend" \
  "npm run dev --workspace=frontend"
