$tokenFile = "c:\Users\ymyex\Projects\Nova-AI-Assistant\gmail_token.json"

Write-Host "Checking for refresh token in: $tokenFile"

if (Test-Path $tokenFile) {
    try {
        $content = Get-Content $tokenFile -Raw
        if ($content -match '"refresh_token"') {
            Write-Host "SUCCESS: Refresh token FOUND!" -ForegroundColor Green
            Write-Host "The Gmail connection should now persist after restarts." -ForegroundColor Green
        } else {
            Write-Host "FAILURE: Refresh token NOT found." -ForegroundColor Red
            Write-Host "Please restart the backend and authenticate again. Make sure to click 'Continue' and 'Allow' on the Google consent screens." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error reading token file: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Token file not found." -ForegroundColor Yellow
    Write-Host "Please start the backend to initiate authentication." -ForegroundColor Cyan
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
