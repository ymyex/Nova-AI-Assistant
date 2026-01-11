# Run this script as Administrator to update the scheduled task
$taskName = "StartNovaBackend"
$vbsPath = "c:\Users\ymyex\Projects\Nova-AI-Assistant\run_silent.vbs"

Write-Host "Updating Nova Backend scheduled task..." -ForegroundColor Cyan

# Remove existing task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Create action
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""

# Create triggers: AtLogon + AtStartup for reliability
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger2 = New-ScheduledTaskTrigger -AtStartup

# Create principal (run as current user with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# Settings: Don't stop on battery, no time limit, ignore new instances if already running
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew -StartWhenAvailable

# Register task
Register-ScheduledTask -Action $action -Trigger $trigger1,$trigger2 -Principal $principal -Settings $settings -TaskName $taskName -Description "Auto-start Nova AI Assistant Backend" -Force

Write-Host ""
Write-Host "SUCCESS! Task '$taskName' updated with:" -ForegroundColor Green
Write-Host "  - AtLogon trigger (runs when you log in)" -ForegroundColor White
Write-Host "  - AtStartup trigger (runs when Windows starts)" -ForegroundColor White
Write-Host "  - MultipleInstances: IgnoreNew (prevents duplicates)" -ForegroundColor White
Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Gray
Read-Host
