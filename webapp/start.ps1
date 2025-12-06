# Start Backend and Frontend
Write-Host "🚀 Smart Investment AI - Starting Services" -ForegroundColor Cyan
Write-Host ""

# Check if node is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found! Install from nodejs.org" -ForegroundColor Red
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

# Start Backend
Write-Host "📡 Starting Backend (FastAPI)..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir\webapp\backend'; python main.py" -PassThru

Start-Sleep -Seconds 2

# Install frontend deps if needed
$frontendDir = "$projectDir\webapp\frontend"
if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location $frontendDir
    npm install
}

# Start Frontend
Write-Host "🎨 Starting Frontend (Next.js)..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -PassThru

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Services Started!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter to stop all services..."
Read-Host

# Cleanup
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
Write-Host "🛑 Services stopped" -ForegroundColor Yellow
