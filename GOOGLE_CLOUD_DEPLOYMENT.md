# 🚀 Google Cloud Run Deployment Guide

This guide walks you through deploying FinX to **Google Cloud Run** using **GitHub Actions**.

---

## 📋 What You Need

1. ✅ Google Cloud account with billing enabled
2. ✅ GitHub account with your code
3. ✅ Your API keys (Groq, Alpaca)

---

## 🔧 Step 1: Create Google Cloud Project

### A. Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top → **"New Project"**
3. Name: `finx-investment` (or whatever you want)
4. Click **Create**
5. 📝 **Note your Project ID** - you'll need it later

### B. Enable APIs

Open **Cloud Shell** (click `>_` icon at top right of Google Console):

```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## 🔑 Step 2: Create Service Account

This lets GitHub deploy to your Google Cloud.

### A. Create the Account

1. In Google Console, go to **IAM & Admin** → **Service Accounts**
2. Click **"+ CREATE SERVICE ACCOUNT"**
3. Fill in:
   - Name: `github-deployer`
   - ID: `github-deployer`
4. Click **"CREATE AND CONTINUE"**

### B. Add Permissions

Add these 3 roles:
- **Cloud Run Admin**
- **Storage Admin** 
- **Service Account User**

Click **"CONTINUE"** → **"DONE"**

### C. Download JSON Key

1. Click on your new service account
2. Go to **"Keys"** tab
3. Click **"ADD KEY"** → **"Create new key"**
4. Choose **JSON** → Click **"CREATE"**
5. 📁 A file downloads - **save this safely!**

---

## 🔒 Step 3: Add Secrets to GitHub

### A. Go to Repository Settings

1. Open your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**

### B. Add These 5 Secrets

| Secret Name | What to Put |
|-------------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID |
| `GCP_SA_KEY` | Copy-paste the ENTIRE JSON file contents |
| `GROQ_API_KEY` | Your Groq API key |
| `ALPACA_API_KEY` | Your Alpaca API key |
| `ALPACA_SECRET_KEY` | Your Alpaca secret key |

### For the JSON Key:

1. Open the downloaded `.json` file with Notepad
2. Select ALL (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste into the `GCP_SA_KEY` secret field

---

## 📤 Step 4: Push to GitHub

### If you haven't pushed your code yet:

Open PowerShell in your project folder:

```powershell
# Initialize git
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial deployment"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push!
git push -u origin main
```

---

## ✨ Step 5: Watch It Deploy!

1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. You'll see your deployment running
4. Wait ~5-10 minutes for it to complete
5. At the end, you'll see URLs like:
   - `https://finx-frontend-xxxxx-uc.a.run.app`
   - `https://finx-backend-xxxxx-uc.a.run.app`

---

## 🎉 Done!

Your app is now:
- ✅ Live on the internet
- ✅ Auto-scales with traffic
- ✅ HTTPS secured
- ✅ Auto-redeploys when you push changes

---

## 🔄 Making Updates

Just push your changes:

```powershell
git add .
git commit -m "Updated something"
git push
```

GitHub Actions automatically redeploys!

---

## 🛠️ Troubleshooting

### View Logs

In Google Cloud Console:
1. Go to **Cloud Run**
2. Click your service
3. Click **"LOGS"** tab

### Deployment Failed?

Check the **Actions** tab in GitHub for error messages.

Common fixes:
- Make sure all 5 secrets are added correctly
- The JSON key must be the complete file contents
- Project ID must match exactly

### Service Not Starting?

Usually an environment variable issue. Check:
- All API keys are set correctly
- No typos in secret names

---

## 💰 Cost Estimate

Google Cloud Run has a **generous free tier**:

| What | Free Per Month |
|------|----------------|
| Requests | 2 million |
| CPU | 180,000 vCPU-seconds |
| Memory | 360,000 GB-seconds |

**For a small-medium app: $0-5/month**

---

## 📞 Quick Reference

| What | Where |
|------|-------|
| Google Console | [console.cloud.google.com](https://console.cloud.google.com) |
| GitHub Actions | Your repo → Actions tab |
| Cloud Run Services | Google Console → Cloud Run |
| Logs | Cloud Run → Your service → Logs |

---

## ✅ Checklist

- [ ] Google Cloud project created
- [ ] APIs enabled
- [ ] Service account created
- [ ] JSON key downloaded
- [ ] GitHub secrets added:
  - [ ] GCP_PROJECT_ID
  - [ ] GCP_SA_KEY
  - [ ] GROQ_API_KEY
  - [ ] ALPACA_API_KEY
  - [ ] ALPACA_SECRET_KEY
- [ ] Code pushed to GitHub
- [ ] Deployment successful!
