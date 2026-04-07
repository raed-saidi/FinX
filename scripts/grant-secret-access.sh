#!/bin/bash
# Grant github-deployer service account access to all secrets

PROJECT_ID="finx-480311"
SERVICE_ACCOUNT="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Granting Secret Manager Secret Accessor role to ${SERVICE_ACCOUNT}..."

# Grant access to each secret
for SECRET in groq_api_key alpaca_api_key alpaca_secret_key fred_api_key qdrant_api_key qdrant_cloud_url jwt_secret password_salt
do
  echo "  Granting access to ${SECRET}..."
  gcloud secrets add-iam-policy-binding ${SECRET} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=${PROJECT_ID}
done

echo "✅ Done! All secrets accessible by github-deployer"
