#!/bin/bash

# Setup Google Cloud Secrets for FinX deployment
# Run this script to create/update secrets in Google Secret Manager

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="us-central1"

echo "🔐 Setting up secrets for project: $PROJECT_ID"
echo ""

# Function to create or update a secret
create_or_update_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    echo "📝 Processing secret: $SECRET_NAME"
    
    # Check if secret exists
    if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
        echo "  ✓ Secret exists, adding new version..."
        echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
            --project="$PROJECT_ID" \
            --data-file=-
    else
        echo "  + Creating new secret..."
        echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
            --project="$PROJECT_ID" \
            --replication-policy="automatic" \
            --data-file=-
    fi
    
    echo "  ✓ Done"
    echo ""
}

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Prompt for secrets
echo "Please enter your API keys (press Enter to skip):"
echo ""

read -p "GROQ_API_KEY: " GROQ_API_KEY
read -p "ALPACA_API_KEY: " ALPACA_API_KEY
read -s -p "ALPACA_SECRET_KEY: " ALPACA_SECRET_KEY
echo ""
read -p "FRED_API_KEY: " FRED_API_KEY
read -s -p "JWT_SECRET (or press Enter for auto-generated): " JWT_SECRET
echo ""
read -s -p "PASSWORD_SALT (or press Enter for auto-generated): " PASSWORD_SALT
echo ""

# Generate JWT_SECRET if not provided
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "  ℹ Auto-generated JWT_SECRET"
fi

# Generate PASSWORD_SALT if not provided
if [ -z "$PASSWORD_SALT" ]; then
    PASSWORD_SALT=$(openssl rand -hex 16)
    echo "  ℹ Auto-generated PASSWORD_SALT"
fi

echo ""
echo "🚀 Creating/updating secrets in Google Secret Manager..."
echo ""

# Create/update each secret
[ -n "$GROQ_API_KEY" ] && create_or_update_secret "GROQ_API_KEY" "$GROQ_API_KEY"
[ -n "$ALPACA_API_KEY" ] && create_or_update_secret "ALPACA_API_KEY" "$ALPACA_API_KEY"
[ -n "$ALPACA_SECRET_KEY" ] && create_or_update_secret "ALPACA_SECRET_KEY" "$ALPACA_SECRET_KEY"
[ -n "$FRED_API_KEY" ] && create_or_update_secret "FRED_API_KEY" "$FRED_API_KEY"
[ -n "$JWT_SECRET" ] && create_or_update_secret "JWT_SECRET" "$JWT_SECRET"
[ -n "$PASSWORD_SALT" ] && create_or_update_secret "PASSWORD_SALT" "$PASSWORD_SALT"

echo "✅ All secrets have been configured!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure your Cloud Run service account has access to these secrets"
echo "2. Grant secret accessor role:"
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "     --member='serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com' \\"
echo "     --role='roles/secretmanager.secretAccessor'"
echo ""
echo "3. Re-deploy your application with:"
echo "   git push origin main"
echo ""
