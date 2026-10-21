@echo off
rem ============================================================================
rem  GORE FORGE - Instalador para Windows (Usuario)   Versao @@VERSAO@@
rem
rem  Este arquivo e apenas o lancador: toda a logica esta em Instalador.ps1
rem  (mesma pasta). Nao precisa de administrador: instala em %LOCALAPPDATA%,
rem  cria atalhos do usuario e registra a desinstalacao em HKCU.
rem
rem  Opcoes uteis (linha de comando):
rem    "Instalar GORE FORGE.cmd" -Destino "D:\Jogos\GORE FORGE"
rem    "Instalar GORE FORGE.cmd" -NaoAbrir
rem ============================================================================

chcp 65001 >nul 2>&1
title Instalador GORE FORGE
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "GF_PASTA=%~dp0."
set "GF_GAME=%~dp0goreforge.html"

echo.
echo   ==========================================================
echo      G O R E   F O R G E            instalador  v@@VERSAO@@
echo      sandbox de fisica, gelatina e gore  -  offline
echo   ==========================================================
echo.

if not exist "%GF_GAME%" (
  echo   [ERRO] Nao encontrei o arquivo "goreforge.html" nesta pasta:
  echo          %GF_PASTA%
  echo.
  echo   Extraia TODOS os arquivos do ZIP para a mesma pasta e rode de novo.
  echo.
  pause
  exit /b 1
)

echo   [1/3] Removendo bloqueio de arquivos baixados da internet...
powershell -NoProfile -ExecutionPolicy Bypass -NoLogo -Command "Get-ChildItem -LiteralPath '%GF_PASTA%' -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

echo   [2/3] Instalando para o seu usuario (sem senha de administrador)...
echo         destino padrao: %%LOCALAPPDATA%%\GORE FORGE
echo.

powershell -NoProfile -ExecutionPolicy Bypass -NoLogo -File "%~dp0Instalador.ps1" %*
set "GF_CODIGO=!ERRORLEVEL!"

if not "!GF_CODIGO!"=="0" (
  echo.
  echo   [ERRO] O instalador terminou com o codigo !GF_CODIGO!.
  echo.
  echo   O que tentar:
  echo     - clique com o botao direito neste .cmd e escolha "Executar como
  echo       administrador";
  echo     - ou abra o jogo direto: dois cliques em "goreforge.html"
  echo       (o jogo roda sozinho no navegador, sem instalar nada).
  echo.
  pause
  exit /b !GF_CODIGO!
)

echo   [3/3] Pronto.
echo.
exit /b 0
