Set WshShell = CreateObject("WScript.Shell")

' ROBUST CLEANUP: Kill any process using port 80 and related Nova processes
' This prevents multiple instance conflicts after restart

' Method 1: Kill by process name
WshShell.Run "taskkill /F /IM python.exe", 0, True
WshShell.Run "taskkill /F /IM main_v2.exe", 0, True

' Method 2: Kill by window title (in case process name filtering doesn't work)  
WshShell.Run "taskkill /F /FI ""WINDOWTITLE eq *Nova*""", 0, True
WshShell.Run "taskkill /F /FI ""WINDOWTITLE eq *uvicorn*""", 0, True

' Wait for port to be fully released (TIME_WAIT state can linger)
WScript.Sleep 3000

' Start the backend silently (no --reload to prevent subprocess issues)
WshShell.CurrentDirectory = "c:\Users\ymyex\Projects\Nova-AI-Assistant"
WshShell.Run "python -m uvicorn app.main:app --host 0.0.0.0 --port 80", 0, False

Set WshShell = Nothing
