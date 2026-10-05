#!/usr/bin/env bash
set -e

echo "=== Running AquaSentinel Test Suite ==="

# Build shared types
npm run build --workspace=shared

# Run unit and integration tests in backend
npm run test --workspace=backend
