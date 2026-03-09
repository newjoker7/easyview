@echo off
cd /d "%~dp0"
if "%~1"=="" (
  set MSG=Atualizacao
) else (
  set MSG=%~1
)
echo [ok] A adicionar ficheiros...
git add .
echo [ok] A fazer commit: %MSG%
git commit -m "%MSG%"
echo [ok] A enviar para o repositorio (git push)...
git push
echo [ok] Concluido. Agora no VPS execute: ./update-on-server.sh
pause
