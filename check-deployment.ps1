# Check Odyssey Deployment Status
# Run this script to verify if backend and frontend are deployed

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "   ODYSSEY DEPLOYMENT STATUS CHECK" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Check GitHub Actions status
Write-Host "📊 Checking GitHub Actions..." -ForegroundColor Yellow
$repoUrl = "https://api.github.com/repos/raed-saidi/odyssey/actions/runs?per_page=1"

try {
    $response = Invoke-RestMethod -Uri $repoUrl -Method Get
    $latestRun = $response.workflow_runs[0]
    
    Write-Host "   Workflow: $($latestRun.name)" -ForegroundColor White
    Write-Host "   Status: $($latestRun.status)" -ForegroundColor White
    Write-Host "   Conclusion: $($latestRun.conclusion)" -ForegroundColor $(
        if ($latestRun.conclusion -eq "success") { "Green" }
        elseif ($latestRun.conclusion -eq "failure") { "Red" }
        else { "Yellow" }
    )
    Write-Host "   Run URL: $($latestRun.html_url)`n" -ForegroundColor Cyan
    
    if ($latestRun.conclusion -eq "success") {
        Write-Host "✅ Latest deployment SUCCEEDED!`n" -ForegroundColor Green
    } elseif ($latestRun.conclusion -eq "failure") {
        Write-Host "❌ Latest deployment FAILED!`n" -ForegroundColor Red
        Write-Host "   Check logs at: $($latestRun.html_url)`n" -ForegroundColor Yellow
    } else {
        Write-Host "⏳ Deployment still RUNNING...`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Could not fetch GitHub Actions status" -ForegroundColor Red
    Write-Host "   Error: $_`n" -ForegroundColor Red
}

# Try to ping backend
Write-Host "🔍 Testing Backend..." -ForegroundColor Yellow
$backendUrls = @(
    "https://odyssey-backend-finx-480311.uc.a.run.app",
    "https://backend-finx-480311.uc.a.run.app"
)

$backendFound = $false
foreach ($url in $backendUrls) {
    try {
        $healthUrl = "$url/health"
        Write-Host "   Trying: $healthUrl" -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 10
        Write-Host "✅ Backend is LIVE!" -ForegroundColor Green
        Write-Host "   URL: $url" -ForegroundColor Cyan
        Write-Host "   Health: $($response | ConvertTo-Json -Compress)`n" -ForegroundColor White
        $backendFound = $true
        break
    } catch {
        Write-Host "   ❌ Not found at $url" -ForegroundColor Gray
    }
}

if (-not $backendFound) {
    Write-Host "⚠️  Backend not accessible yet`n" -ForegroundColor Yellow
}

# Try to ping frontend
Write-Host "🌐 Testing Frontend..." -ForegroundColor Yellow
$frontendUrls = @(
    "https://odyssey-frontend-finx-480311.uc.a.run.app",
    "https://frontend-finx-480311.uc.a.run.app"
)

$frontendFound = $false
foreach ($url in $frontendUrls) {
    try {
        Write-Host "   Trying: $url" -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Frontend is LIVE!" -ForegroundColor Green
            Write-Host "   URL: $url" -ForegroundColor Cyan
            Write-Host "   Status: $($response.StatusCode) OK`n" -ForegroundColor White
            $frontendFound = $true
            break
        }
    } catch {
        Write-Host "   ❌ Not found at $url" -ForegroundColor Gray
    }
}

if (-not $frontendFound) {
    Write-Host "⚠️  Frontend not accessible yet`n" -ForegroundColor Yellow
}

# Summary
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "   SUMMARY" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

if ($backendFound -and $frontendFound) {
    Write-Host "🎉 ALL SERVICES ARE LIVE!" -ForegroundColor Green
    Write-Host "   Ready for hackathon demo!`n" -ForegroundColor Green
} elseif ($backendFound) {
    Write-Host "⚠️  Backend up, frontend deploying..." -ForegroundColor Yellow
    Write-Host "   Check again in 2-3 minutes`n" -ForegroundColor Yellow
} else {
    Write-Host "⏳ Services still deploying..." -ForegroundColor Yellow
    Write-Host "   Check GitHub Actions for progress:" -ForegroundColor Yellow
    Write-Host "   https://github.com/raed-saidi/odyssey/actions`n" -ForegroundColor Cyan
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
