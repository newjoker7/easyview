#!/bin/bash
# Atualiza o projeto no servidor com git pull SEM sobrescrever .env nem server/uploads.
# Uso: no VPS, na pasta do projeto: ./update-on-server.sh

set -e
cd "$(dirname "$0")"

# 1) Backup do .env (variáveis de configuração do servidor)
if [ -f .env ]; then
  cp .env .env.backup.server
  echo "[ok] Backup de .env guardado em .env.backup.server"
fi

# 2) Atualizar código do repositório (pull do branch atual a partir de origin)
echo "[ok] A fazer git pull..."
BRANCH=$(git branch --show-current)
git pull origin "$BRANCH"

# 3) Restaurar .env do servidor (nunca usar o do repositório)
if [ -f .env.backup.server ]; then
  mv .env.backup.server .env
  echo "[ok] .env restaurado (configuração do servidor mantida)"
fi

# 4) Rebuild e reiniciar Docker (se usar)
if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
  echo "[ok] A reconstruir e a reiniciar Docker..."
  docker compose build --no-cache
  docker compose up -d
  echo "[ok] A reiniciar os containers para carregar os ficheiros novos..."
  docker compose restart
  echo "[ok] Docker em execução."
fi

echo "[ok] Atualização concluída. As variáveis de configuração (.env) não foram alteradas."
