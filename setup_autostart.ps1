# Run this script as Administrator to set up the scheduled task
$taskName = "StartNovaBackend"
$vbsPath = "c:\Users\ymyex\Projects\Nova-AI-Assistant\run_silent.vbs"

Write-Host "Setting up Nova Backend scheduled task..." -ForegroundColor Cyan

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Create action
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""

# Single trigger: At system startup
$trigger = New-ScheduledTaskTrigger -AtStartup

# Create principal (run as SYSTEM at boot with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Settings: Don't stop on battery, no time limit, ignore new instances if already running
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew -StartWhenAvailable

# Register task
Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName $taskName -Description "Auto-start Nova AI Assistant Backend" -Force

Write-Host ""
Write-Host "SUCCESS! Task '$taskName' created with:" -ForegroundColor Green
Write-Host "  - AtStartup trigger (runs when Windows boots)" -ForegroundColor White
Write-Host "  - Runs as SYSTEM (no login required)" -ForegroundColor White
Write-Host "  - MultipleInstances: IgnoreNew (prevents duplicates)" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Gray
Read-Host
