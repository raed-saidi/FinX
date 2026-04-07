# Start FastAPI Backend Server
Write-Host "Starting FinX Backend Server..." -ForegroundColor Cyan

# Check if running from correct directory
if (-not (Test-Path "main.py")) {
    Write-Host "Error: main.py not found. Run this script from webapp/backend directory." -ForegroundColor Red
    exit 1
}

# Start the server
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
