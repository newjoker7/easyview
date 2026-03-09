# Envia as alterações do projeto para o Git (GitHub/GitLab).
# Uso: ./update-and-push.ps1
#      ./update-and-push.ps1 "Minha mensagem de commit"

param(
    [string]$mensagem = "Atualização"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[ok] A adicionar ficheiros..." -ForegroundColor Cyan
git add .

Write-Host "[ok] A fazer commit: $mensagem" -ForegroundColor Cyan
git commit -m $mensagem

Write-Host "[ok] A enviar para o repositório (git push)..." -ForegroundColor Cyan
git push

Write-Host "[ok] Concluido. Agora no VPS execute: ./update-on-server.sh" -ForegroundColor Green
