#!/bin/sh
set -e
echo "[entrypoint] Installing root dependencies..."
npm ci
echo "[entrypoint] Installing server dependencies..."
cd server && npm ci && cd /app
echo "[entrypoint] Starting backend and Vite..."
exec sh -c "node server/index.js & npm run dev"
