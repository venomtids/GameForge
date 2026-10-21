@echo off
setlocal
cd /d "%~dp0"
echo GameForge Studio - Gerar instalador Windows x64
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 24 LTS para COMPILAR o codigo-fonte.
  echo O usuario final do instalador nao precisa de Node.js.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 goto :falhou
call npm test
if errorlevel 1 goto :falhou
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run desktop:win
if errorlevel 1 goto :falhou
echo.
echo Instalador, checksum e instrucoes em dist\windows
start "" "%~dp0dist\windows"
pause
exit /b 0
:falhou
echo.
echo A compilacao falhou. Veja o erro acima.
echo Verifique a versao do Node e a conexao para baixar Electron e NSIS.
pause
exit /b 1
