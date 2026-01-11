@echo off
cd /d "c:\Users\ymyex\Projects\Nova-AI-Assistant"
title Nova Backend Server

echo ============================================
echo  NOVA AI ASSISTANT - BACKEND STARTUP
echo ============================================
echo.

REM ROBUST CLEANUP: Kill any existing instances
echo [1/3] Cleaning up existing processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM main_v2.exe 2>nul
taskkill /F /FI "WINDOWTITLE eq *Nova*" 2>nul
taskkill /F /FI "WINDOWTITLE eq *uvicorn*" 2>nul

REM Wait for port 80 to be fully released
echo [2/3] Waiting for port 80 to be released...
timeout /t 3 /nobreak >nul

REM Start the backend
echo [3/3] Starting Nova AI Assistant Backend...
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 80

REM If we get here, the server stopped
echo.
echo Backend stopped. Press any key to exit.
pause >nul
