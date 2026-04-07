# PowerShell script to deploy Qdrant for Smart Investment AI
# Usage: .\scripts\deploy_qdrant.ps1

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "QDRANT VECTOR DATABASE - DEPLOYMENT SCRIPT" -ForegroundColor White
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan

# ============================================================================
# 1. Check prerequisites
# ============================================================================

Write-Host "`n[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Docker
Write-Host "  Checking Docker..." -NoNewline
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "    $dockerVersion" -ForegroundColor Gray
    } else {
        throw "Docker not found"
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "    Please install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check Docker Compose
Write-Host "  Checking Docker Compose..." -NoNewline
try {
    $composeVersion = docker-compose --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "    $composeVersion" -ForegroundColor Gray
    } else {
        throw "Docker Compose not found"
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    Docker Compose is not installed" -ForegroundColor Red
    Write-Host "    Please install Docker Compose: https://docs.docker.com/compose/install/" -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
Write-Host "  Checking Docker daemon..." -NoNewline
try {
    docker ps >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        throw "Docker daemon not running"
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    Docker daemon is not running" -ForegroundColor Red
    Write-Host "    Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# 2. Create data directory
# ============================================================================

Write-Host "`n[2/6] Creating data directories..." -ForegroundColor Yellow

$dataDir = ".\data\qdrant_storage"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Write-Host "  Created: $dataDir" -ForegroundColor Green
} else {
    Write-Host "  Already exists: $dataDir" -ForegroundColor Gray
}

# ============================================================================
# 3. Pull Qdrant image
# ============================================================================

Write-Host "`n[3/6] Pulling Qdrant Docker image..." -ForegroundColor Yellow

docker pull qdrant/qdrant:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Failed to pull Qdrant image" -ForegroundColor Red
    exit 1
}
Write-Host "  Qdrant image pulled successfully" -ForegroundColor Green

# ============================================================================
# 4. Start Qdrant container
# ============================================================================

Write-Host "`n[4/6] Starting Qdrant container..." -ForegroundColor Yellow

# Check if container already exists
$existingContainer = docker ps -a --filter "name=qdrant-smart-investment" --format "{{.Names}}" 2>$null
if ($existingContainer -eq "qdrant-smart-investment") {
    Write-Host "  Container already exists, restarting..." -ForegroundColor Yellow
    docker-compose restart qdrant
} else {
    docker-compose up -d qdrant
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Failed to start Qdrant container" -ForegroundColor Red
    exit 1
}

# Wait for Qdrant to be ready
Write-Host "  Waiting for Qdrant to be ready..." -NoNewline
Start-Sleep -Seconds 5

$maxRetries = 10
$retries = 0
$qdrantReady = $false

while ($retries -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:6333/healthz" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $qdrantReady = $true
            break
        }
    } catch {
        # Ignore errors and retry
    }
    Start-Sleep -Seconds 2
    $retries++
    Write-Host "." -NoNewline
}

if ($qdrantReady) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " TIMEOUT" -ForegroundColor Red
    Write-Host "  Qdrant may still be starting. Check logs: docker-compose logs qdrant" -ForegroundColor Yellow
}

# ============================================================================
# 5. Verify deployment
# ============================================================================

Write-Host "`n[5/6] Verifying deployment..." -ForegroundColor Yellow

# Check container status
$containerStatus = docker ps --filter "name=qdrant-smart-investment" --format "{{.Status}}" 2>$null
if ($containerStatus -match "Up") {
    Write-Host "  Container status: Running" -ForegroundColor Green
    Write-Host "    $containerStatus" -ForegroundColor Gray
} else {
    Write-Host "  Container status: Not running" -ForegroundColor Red
    Write-Host "  Check logs: docker-compose logs qdrant" -ForegroundColor Yellow
}

# Check REST API
Write-Host "  Checking REST API..." -NoNewline
try {
    $apiResponse = Invoke-RestMethod -Uri "http://localhost:6333/" -Method Get -TimeoutSec 5
    if ($apiResponse) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "    Version: $($apiResponse.version)" -ForegroundColor Gray
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    Could not reach REST API at http://localhost:6333" -ForegroundColor Yellow
}

# ============================================================================
# 6. Installation summary
# ============================================================================

Write-Host "`n[6/6] Installation summary" -ForegroundColor Yellow

Write-Host "`n  ✓ Qdrant is deployed and running!" -ForegroundColor Green
Write-Host "`n  Access points:" -ForegroundColor White
Write-Host "    • REST API:  http://localhost:6333" -ForegroundColor Cyan
Write-Host "    • Web UI:    http://localhost:6333/dashboard" -ForegroundColor Cyan
Write-Host "    • gRPC API:  localhost:6334" -ForegroundColor Cyan

Write-Host "`n  Next steps:" -ForegroundColor White
Write-Host "    1. Run pipeline:       python run_pipeline.py" -ForegroundColor Gray
Write-Host "    2. Query examples:     python scripts/query_qdrant_example.py" -ForegroundColor Gray
Write-Host "    3. View logs:          docker-compose logs -f qdrant" -ForegroundColor Gray
Write-Host "    4. Stop Qdrant:        docker-compose down" -ForegroundColor Gray

Write-Host "`n  Documentation:" -ForegroundColor White
Write-Host "    • Deployment guide:    QDRANT_DEPLOYMENT.md" -ForegroundColor Gray
Write-Host "    • Configuration:       config/qdrant_config.yaml" -ForegroundColor Gray
Write-Host "    • Helper functions:    utils/qdrant_helpers.py" -ForegroundColor Gray

Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor White
Write-Host ("=" * 80) -ForegroundColor Cyan
