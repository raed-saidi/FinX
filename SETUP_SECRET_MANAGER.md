# Google Secret Manager Setup Guide

This guide walks you through setting up Google Secret Manager to securely manage your production secrets for the Odyssey AI Trading Platform.

## Prerequisites

- Google Cloud Project created (`odyssey` or your project name)
- `gcloud` CLI installed and authenticated
- Billing enabled on your GCP project
- Owner or Editor permissions on the project

## Step 1: Enable Secret Manager API

```bash
# Enable the Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep secretmanager
```

## Step 2: Create Secrets

Create a secret for each API key and sensitive configuration:

```bash
# Set your project ID
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID

# Create secrets (without values - we'll add values next)
gcloud secrets create groq_api_key --replication-policy="automatic"
gcloud secrets create alpaca_api_key --replication-policy="automatic"
gcloud secrets create alpaca_secret_key --replication-policy="automatic"
gcloud secrets create fred_api_key --replication-policy="automatic"
gcloud secrets create qdrant_api_key --replication-policy="automatic"
gcloud secrets create qdrant_cloud_url --replication-policy="automatic"
gcloud secrets create jwt_secret --replication-policy="automatic"
gcloud secrets create password_salt --replication-policy="automatic"
```

## Step 3: Add Secret Values

Add the actual secret values (replace with your real keys):

```bash
# GROQ API Key
echo -n "your_actual_groq_api_key" | \
  gcloud secrets versions add groq_api_key --data-file=-

# Alpaca API Keys
echo -n "your_actual_alpaca_api_key" | \
  gcloud secrets versions add alpaca_api_key --data-file=-

echo -n "your_actual_alpaca_secret_key" | \
  gcloud secrets versions add alpaca_secret_key --data-file=-

# FRED API Key
echo -n "your_actual_fred_api_key" | \
  gcloud secrets versions add fred_api_key --data-file=-

# Qdrant Configuration
echo -n "your_qdrant_api_key" | \
  gcloud secrets versions add qdrant_api_key --data-file=-

echo -n "https://your-cluster.cloud.qdrant.io:6333" | \
  gcloud secrets versions add qdrant_cloud_url --data-file=-

# Generate and store JWT secret
python3 -c "import secrets; print(secrets.token_urlsafe(64))" | \
  gcloud secrets versions add jwt_secret --data-file=-

# Generate and store password salt
python3 -c "import secrets; print(secrets.token_hex(32))" | \
  gcloud secrets versions add password_salt --data-file=-
```

## Step 4: Grant Cloud Run Access to Secrets

Create a service account for Cloud Run and grant it access:

```bash
# Create service account
gcloud iam service-accounts create odyssey-cloud-run \
  --display-name="Odyssey Cloud Run Service Account"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:odyssey-cloud-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run Invoker role (for inter-service communication)
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:odyssey-cloud-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

## Step 5: Update Cloud Run Deployment

Update your `.github/workflows/ci-cd.yml` to reference secrets instead of inline env vars:

```yaml
- name: Deploy Backend to Cloud Run
  run: |
    gcloud run deploy odyssey-backend \
      --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/odyssey-backend:${{ github.sha }} \
      --platform managed \
      --region us-central1 \
      --service-account odyssey-cloud-run@${{ secrets.GCP_PROJECT_ID }}.iam.gserviceaccount.com \
      --allow-unauthenticated \
      --set-secrets="GROQ_API_KEY=groq_api_key:latest,\
ALPACA_API_KEY=alpaca_api_key:latest,\
ALPACA_SECRET_KEY=alpaca_secret_key:latest,\
FRED_API_KEY=fred_api_key:latest,\
QDRANT_API_KEY=qdrant_api_key:latest,\
QDRANT_CLOUD_URL=qdrant_cloud_url:latest,\
JWT_SECRET=jwt_secret:latest,\
PASSWORD_SALT=password_salt:latest" \
      --memory 2Gi \
      --cpu 2 \
      --timeout 300 \
      --max-instances 10
```

## Step 6: Verify Secrets

```bash
# List all secrets
gcloud secrets list

# View secret metadata (not the value)
gcloud secrets describe groq_api_key

# Access a secret value (for testing)
gcloud secrets versions access latest --secret="groq_api_key"
```

## Step 7: Remove Inline Secrets from GitHub Actions

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. **Remove** these secrets (they're now in GCP Secret Manager):
   - `GROQ_API_KEY`
   - `ALPACA_API_KEY`
   - `ALPACA_SECRET_KEY`
   - `FRED_API_KEY`
   
4. **Keep** these secrets (needed for deployment):
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY` (service account key for GitHub Actions)

## Step 8: Update CI/CD Workflow

Replace inline environment variables with `--set-secrets` in `.github/workflows/ci-cd.yml`:

```yaml
# ❌ OLD WAY (insecure - secrets in workflow logs)
--set-env-vars GROQ_API_KEY=${{ secrets.GROQ_API_KEY }}

# ✅ NEW WAY (secure - secrets in Secret Manager)
--set-secrets="GROQ_API_KEY=groq_api_key:latest"
```

## Security Best Practices

### 1. Secret Rotation

Rotate secrets regularly:

```bash
# Add a new version of a secret
echo -n "new_secret_value" | \
  gcloud secrets versions add groq_api_key --data-file=-

# Disable old version
gcloud secrets versions disable 1 --secret="groq_api_key"

# Destroy old version (after testing new one works)
gcloud secrets versions destroy 1 --secret="groq_api_key"
```

### 2. Audit Secret Access

```bash
# View who accessed secrets
gcloud logging read "resource.type=secretmanager.googleapis.com/Secret" \
  --limit 50 \
  --format json
```

### 3. Set up Secret Expiration

```bash
# Create secret with expiration
gcloud secrets create temp_api_key \
  --replication-policy="automatic" \
  --expire-time="2025-12-31T23:59:59Z"
```

### 4. Use Secret Versioning

Always reference secrets by version in production:

```yaml
# Specific version (recommended for production)
--set-secrets="GROQ_API_KEY=groq_api_key:3"

# Latest version (good for development)
--set-secrets="GROQ_API_KEY=groq_api_key:latest"
```

## Cost Estimation

Secret Manager pricing (as of Dec 2024):
- **Active secret versions**: $0.06 per secret/month
- **Access operations**: $0.03 per 10,000 operations
- **Example**: 8 secrets = ~$0.50/month

## Troubleshooting

### Issue: "Permission Denied" when accessing secrets

```bash
# Check service account permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:odyssey-cloud-run@*"

# Add secretAccessor role if missing
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:odyssey-cloud-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Issue: Cloud Run can't find secrets

```bash
# Verify secret exists
gcloud secrets describe groq_api_key

# Check secret has a value
gcloud secrets versions list groq_api_key

# Test access from Cloud Run service account
gcloud secrets versions access latest --secret="groq_api_key" \
  --impersonate-service-account="odyssey-cloud-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
```

### Issue: Old secrets still being used

```bash
# Force new deployment to pick up secrets
gcloud run services update odyssey-backend \
  --region us-central1 \
  --update-secrets="GROQ_API_KEY=groq_api_key:latest"
```

## Verification Checklist

- [ ] Secret Manager API enabled
- [ ] All 8 secrets created with values
- [ ] Service account created (odyssey-cloud-run)
- [ ] Service account has secretAccessor role
- [ ] Cloud Run services use --set-secrets flag
- [ ] GitHub Actions secrets reduced (only GCP credentials remain)
- [ ] Tested deployment with secrets from Secret Manager
- [ ] Verified application can access secrets at runtime
- [ ] Documented secret rotation schedule
- [ ] Set up CloudWatch alerts for secret access

## Next Steps

After completing this setup:

1. **Update CI/CD workflow** to use `--set-secrets` instead of inline env vars
2. **Test deployment** to ensure secrets are accessible
3. **Remove inline secrets** from GitHub Actions
4. **Document** which secrets exist and who has access
5. **Set up rotation schedule** (every 90 days recommended)

## References

- [Google Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Secret Manager Integration](https://cloud.google.com/run/docs/configuring/secrets)
- [Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)
