@echo off
cd /d "c:\Users\ymyex\Projects\Nova-AI-Assistant"
title Nova Backend Server

echo ============================================
echo  NOVA AI ASSISTANT - BACKEND STARTUP
echo ============================================
echo.

REM SURGICAL CLEANUP: Kill only Nova-related processes, not all Python/Node
echo [1/3] Cleaning up existing Nova processes...

REM Kill WhatsApp Bridges (Go binaries)
REM main.exe is too generic - skip taskkill, let Python handle it
taskkill /F /IM main.exe 2>nul
taskkill /F /IM whatsapp-bridge.exe 2>nul

REM Kill specifically matched Python processes to avoid killing the IDE or other apps
REM 1. Nova Backend
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*app.main*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM 2. Windows MCP (if running separately)
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*windows_mcp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM 3. WhatsApp MCP Server (if running separately)
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*whatsapp-mcp-server*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM Kill Node.js processes related to Nova
REM 1. OpenCode
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*opencode*serve*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM 2. Vite (Frontend Dev Server)
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

REM Wait for port 80 to be fully released
echo [2/3] Waiting for port 80 to be released...
timeout /t 2 /nobreak >nul

REM Start the backend (OpenCode server auto-starts via Python if configured)
echo [3/3] Starting Nova AI Assistant Backend...
echo       (OpenCode server will auto-start on first request)
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 80 --no-access-log --log-level warning

REM If we get here, the server stopped
echo.
echo Backend stopped. Press any key to exit.
pause >nul
