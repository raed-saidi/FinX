# Setup Google Cloud Secrets for FinX deployment
# Run this script to create/update secrets in Google Secret Manager

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = $env:GCP_PROJECT_ID
if (-not $PROJECT_ID) {
    $PROJECT_ID = Read-Host "Enter your GCP Project ID"
}

Write-Host "🔐 Setting up secrets for project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

# Function to create or update a secret
function Create-Or-Update-Secret {
    param(
        [string]$SecretName,
        [string]$SecretValue
    )
    
    Write-Host "📝 Processing secret: $SecretName" -ForegroundColor Yellow
    
    # Check if secret exists
    $secretExists = gcloud secrets describe $SecretName --project=$PROJECT_ID 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Secret exists, adding new version..." -ForegroundColor Green
        $SecretValue | gcloud secrets versions add $SecretName --project=$PROJECT_ID --data-file=-
    } else {
        Write-Host "  + Creating new secret..." -ForegroundColor Green
        $SecretValue | gcloud secrets create $SecretName --project=$PROJECT_ID --replication-policy="automatic" --data-file=-
    }
    
    Write-Host "  ✓ Done" -ForegroundColor Green
    Write-Host ""
}

# Check if gcloud is authenticated
try {
    $account = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Not authenticated"
    }
} catch {
    Write-Host "❌ Error: Not authenticated with gcloud" -ForegroundColor Red
    Write-Host "Run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Please enter your API keys (press Enter to skip):" -ForegroundColor Cyan
Write-Host ""

$GROQ_API_KEY = Read-Host "GROQ_API_KEY"
$ALPACA_API_KEY = Read-Host "ALPACA_API_KEY"
$ALPACA_SECRET_KEY = Read-Host "ALPACA_SECRET_KEY" -AsSecureString
$ALPACA_SECRET_KEY_TEXT = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ALPACA_SECRET_KEY))

$FRED_API_KEY = Read-Host "FRED_API_KEY"

$JWT_SECRET = Read-Host "JWT_SECRET (or press Enter for auto-generated)"
if ([string]::IsNullOrWhiteSpace($JWT_SECRET)) {
    $JWT_SECRET = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    Write-Host "  ℹ Auto-generated JWT_SECRET" -ForegroundColor Cyan
}

$PASSWORD_SALT = Read-Host "PASSWORD_SALT (or press Enter for auto-generated)"
if ([string]::IsNullOrWhiteSpace($PASSWORD_SALT)) {
    $PASSWORD_SALT = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    Write-Host "  ℹ Auto-generated PASSWORD_SALT" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🚀 Creating/updating secrets in Google Secret Manager..." -ForegroundColor Cyan
Write-Host ""

# Create/update each secret
if ($GROQ_API_KEY) { Create-Or-Update-Secret "GROQ_API_KEY" $GROQ_API_KEY }
if ($ALPACA_API_KEY) { Create-Or-Update-Secret "ALPACA_API_KEY" $ALPACA_API_KEY }
if ($ALPACA_SECRET_KEY_TEXT) { Create-Or-Update-Secret "ALPACA_SECRET_KEY" $ALPACA_SECRET_KEY_TEXT }
if ($FRED_API_KEY) { Create-Or-Update-Secret "FRED_API_KEY" $FRED_API_KEY }
if ($JWT_SECRET) { Create-Or-Update-Secret "JWT_SECRET" $JWT_SECRET }
if ($PASSWORD_SALT) { Create-Or-Update-Secret "PASSWORD_SALT" $PASSWORD_SALT }

Write-Host "✅ All secrets have been configured!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Ensure your Cloud Run service account has access to these secrets"
Write-Host "2. Grant secret accessor role:"
Write-Host "   gcloud projects add-iam-policy-binding $PROJECT_ID ``" -ForegroundColor Yellow
Write-Host "     --member='serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com' ``" -ForegroundColor Yellow
Write-Host "     --role='roles/secretmanager.secretAccessor'" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Re-deploy your application with:"
Write-Host "   git push origin main" -ForegroundColor Yellow
Write-Host ""
