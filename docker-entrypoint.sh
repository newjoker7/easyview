#!/bin/sh
set -e
echo "[entrypoint] Installing root dependencies..."
npm ci
echo "[entrypoint] Installing server dependencies..."
cd server && npm ci && cd /app
# Instalar nodejs-whisper para extração de legendas (opcional; falha não impede o arranque)
if [ ! -d server/node_modules/nodejs-whisper ]; then
  if (cd server && npm install nodejs-whisper 2>/dev/null); then
    echo "[entrypoint] nodejs-whisper instalado. A baixar modelo tiny..."
    (cd server && npx nodejs-whisper download tiny 2>/dev/null) || true
  else
    echo "[entrypoint] nodejs-whisper não instalado (transcrição indisponível)."
  fi
fi
cd /app
echo "[entrypoint] Starting backend and Vite..."
exec sh -c "node server/index.js & npm run dev"
