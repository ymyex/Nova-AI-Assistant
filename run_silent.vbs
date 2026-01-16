Set WshShell = CreateObject("WScript.Shell")

' SURGICAL CLEANUP: Avoid broad kills that might hit your IDE or other apps
' This script targets specifically Nova's key components

' 1. Kill WhatsApp bridge binaries specifically
WshShell.Run "taskkill /F /IM main.exe", 0, True
WshShell.Run "taskkill /F /IM whatsapp-bridge.exe", 0, True

' 2. Kill Nova Backend Python process using PowerShell for precision
WshShell.Run "powershell -Command ""Get-CimInstance Win32_Process -Filter \""Name='python.exe'\"" | Where-Object { $_.CommandLine -like '*app.main*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True

' 3. Kill Windows MCP (if running separately)
WshShell.Run "powershell -Command ""Get-CimInstance Win32_Process -Filter \""Name='python.exe'\"" | Where-Object { $_.CommandLine -like '*windows_mcp*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True

' 4. Kill WhatsApp MCP Server (if running separately)
WshShell.Run "powershell -Command ""Get-CimInstance Win32_Process -Filter \""Name='python.exe'\"" | Where-Object { $_.CommandLine -like '*whatsapp-mcp-server*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True

' 5. Kill OpenCode server specifically
WshShell.Run "powershell -Command ""Get-CimInstance Win32_Process -Filter \""Name='node.exe'\"" | Where-Object { $_.CommandLine -like '*opencode*serve*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True

' 6. Kill Vite (Frontend Dev Server)
WshShell.Run "powershell -Command ""Get-CimInstance Win32_Process -Filter \""Name='node.exe'\"" | Where-Object { $_.CommandLine -like '*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }""", 0, True

' Wait for port to be fully released
WScript.Sleep 2000

' Start the backend silently with reduced logging
WshShell.CurrentDirectory = "c:\Users\ymyex\Projects\Nova-AI-Assistant"
WshShell.Run "python -m uvicorn app.main:app --host 0.0.0.0 --port 80 --no-access-log --log-level warning", 0, False

Set WshShell = Nothing
