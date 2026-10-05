#!/usr/bin/env bash
set -e

echo "=== Running AquaSentinel Database Migrations ==="
npm run migrate --workspace=backend
