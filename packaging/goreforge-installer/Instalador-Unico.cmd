@echo off
rem ============================================================================
rem  GORE FORGE - INSTALADOR UNICO            Windows 10/11 (64 bits)
rem  versao @@VERSAO@@
rem
rem  Este arquivo E o instalador inteiro: o jogo, o icone, o leia-me e o
rem  desinstalador viajam embutidos aqui dentro, em base64. Dois cliques e
rem  pronto - sem internet, sem Node, sem Electron, sem senha de administrador.
rem
rem  Como funciona: um comando do PowerShell le este proprio arquivo, pega o
rem  trecho entre os marcadores GORE-FORGE:INICIO e GORE-FORGE:FIM (as linhas
rem  abaixo do ":falhou", que o cmd.exe nunca chega a ler), decodifica
rem  base64, abre o ZIP na pasta %TEMP% e roda o instalador de verdade de la.
rem
rem  Opcoes (opcional, para quem quiser):
rem    GORE-FORGE-Instalador.cmd -Destino "D:\Jogos\GORE FORGE"
rem    GORE-FORGE-Instalador.cmd -NaoAbrir
rem ============================================================================

chcp 65001 >nul 2>&1
title Instalador GORE FORGE @@VERSAO@@
setlocal
set "GF_SELF=%~f0"
set "GF_PASTA=%TEMP%\GORE-FORGE-Instalador"
set "GF_PACOTE=%TEMP%\GORE-FORGE-Instalador.zip"
set "GF_PS=powershell -NoProfile -ExecutionPolicy Bypass -NoLogo"

echo.
echo   ============================================================
echo      G O R E   F O R G E               instalador v@@VERSAO@@
echo      sandbox de fisica, gelatina e gore  -  jogo offline
echo      arquivo unico: o jogo vem embutido aqui dentro
echo   ============================================================
echo.
echo   Instalando para o seu usuario - sem senha de administrador.
echo.

echo   [1/4] Extraindo o pacote embutido neste arquivo...
rmdir /s /q "%GF_PASTA%" >nul 2>&1
del /f /q "%GF_PACOTE%" >nul 2>&1
%GF_PS% -Command "$ErrorActionPreference='Stop'; $bruto=[IO.File]::ReadAllText($env:GF_SELF); $inicio='---GORE-FORGE'+':INICIO---'; $fim='---GORE-FORGE'+':FIM---'; $a=$bruto.IndexOf($inicio); $b=$bruto.IndexOf($fim); if($a -lt 0 -or $b -lt 0){ Write-Host '  [erro]  Nao achei o pacote embutido: baixe o instalador novamente.'; exit 9 }; $b64=$bruto.Substring($a+$inicio.Length, $b-$a-$inicio.Length); $b64=[Text.RegularExpressions.Regex]::Replace($b64,'[^A-Za-z0-9+/=]',''); [IO.File]::WriteAllBytes($env:GF_PACOTE,[Convert]::FromBase64String($b64)); exit 0"
set "GF_CODIGO=%ERRORLEVEL%"
if not "%GF_CODIGO%"=="0" goto :falhou

echo   [2/4] Abrindo o pacote...
%GF_PS% -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath $env:GF_PACOTE -DestinationPath $env:GF_PASTA -Force; exit 0"
set "GF_CODIGO=%ERRORLEVEL%"
if not "%GF_CODIGO%"=="0" goto :falhou

echo   [3/4] Instalando (atalhos, registro e atalho de desinstalar)...
%GF_PS% -File "%GF_PASTA%\GORE-FORGE-Instalador\Instalador.ps1" %*
set "GF_CODIGO=%ERRORLEVEL%"

echo   [4/4] Limpando os arquivos temporarios...
rmdir /s /q "%GF_PASTA%" >nul 2>&1
del /f /q "%GF_PACOTE%" >nul 2>&1

if not "%GF_CODIGO%"=="0" goto :falhou
echo.
echo   Pronto. O atalho "GORE FORGE" esta na Area de Trabalho e no Menu Iniciar.
echo.
exit /b 0

:falhou
echo.
echo   [ERRO] Nao consegui concluir a instalacao (codigo %GF_CODIGO%).
echo.
echo   O que tentar:
echo     - botao direito neste arquivo e "Executar como administrador";
echo     - abrir o PowerShell e rodar este mesmo arquivo por ele;
echo     - se nada disso funcionar, use o pacote ZIP do GORE FORGE: os arquivos
echo       sao os mesmos e o jogo roda com dois cliques em goreforge.html.
echo.
pause
exit /b 1

---GORE-FORGE:INICIO---
