$taskName = "StartNovaBackend"
$vbsPath = "c:\Users\ymyex\Projects\Nova-AI-Assistant\run_silent.vbs"
$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0

Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName $taskName -Description "Auto-start Nova AI Assistant Backend" -Force

Write-Host "Scheduled Task '$taskName' created successfully."
Write-Host "The backend will now start automatically when you log in."
Pause
