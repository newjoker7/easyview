#!/bin/bash
# Atualiza o projeto no servidor com git pull SEM sobrescrever .env nem server/uploads.
# Uso: no VPS, na pasta do projeto:
#   ./update-on-server.sh         → atualiza código e faz rebuild completo do Docker
#   ./update-on-server.sh --no-build → atualiza código e só reinicia os containers (mais rápido)

set -e
cd "$(dirname "$0")"

SKIP_BUILD=false
for arg in "$@"; do
  if [ "$arg" = "--no-build" ]; then SKIP_BUILD=true; fi
done

# 1) Backup do .env (variáveis de configuração do servidor)
if [ -f .env ]; then
  cp .env .env.backup.server
  echo "[ok] Backup de .env guardado em .env.backup.server"
fi

# 2) Atualizar código do repositório (ficar igual ao remoto; alterações locais são descartadas)
echo "[ok] A buscar e a aplicar alterações do repositório..."
BRANCH=$(git branch --show-current)
git fetch origin
git reset --hard "origin/$BRANCH"

# 3) Restaurar .env do servidor (nunca usar o do repositório)
if [ -f .env.backup.server ]; then
  mv .env.backup.server .env
  echo "[ok] .env restaurado (configuração do servidor mantida)"
fi

# 4) Docker: rebuild (ou só reiniciar se --no-build)
if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
  if [ "$SKIP_BUILD" = true ]; then
    echo "[ok] A reiniciar os containers (sem rebuild)..."
    docker compose up -d
    docker compose restart
  else
    echo "[ok] A reconstruir e a reiniciar Docker..."
    docker compose build --no-cache
    docker compose up -d
    docker compose restart
  fi
  echo "[ok] Docker em execução."
fi

echo "[ok] Atualização concluída. As variáveis de configuração (.env) não foram alteradas."
