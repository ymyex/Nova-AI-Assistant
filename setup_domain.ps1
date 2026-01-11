$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$domain = "nova.ai"
$ip = "127.0.0.1"
$entry = "$ip $domain"

Write-Host "Setting up $domain..."

if (-not (Test-Path $hostsPath)) {
    Write-Error "Hosts file not found at $hostsPath"
    exit 1
}

$content = Get-Content $hostsPath
if ($content -match [regex]::Escape($domain)) {
    Write-Host "$domain is already mapped in hosts file."
} else {
    try {
        Add-Content -Path $hostsPath -Value "`r`n$entry" -ErrorAction Stop
        Write-Host "Successfully added $entry to hosts file."
    } catch {
        Write-Error "Failed to write to hosts file. Please run as Administrator."
        exit 1
    }
}

Write-Host "Flush DNS..."
ipconfig /flushdns

Write-Host "Done! You can now access the app at http://$domain"
Pause
