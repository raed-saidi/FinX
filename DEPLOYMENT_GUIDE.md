# Deployment Guide - Smart Investment AI

## 🚀 Quick Start Deployment

### Option 1: Vercel + Railway (Easiest)

**Frontend → Vercel (Free tier available)**
```bash
cd webapp/frontend
npm install -g vercel
vercel login
vercel --prod
```

**Backend → Railway (Free tier available)**
```bash
npm install -g @railway/cli
railway login
cd webapp/backend
railway init
railway up
```

### Option 2: Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d --build
```

---

## 📝 Making Changes After Deployment

### Method 1: Git Push (Recommended)
```bash
# Make your changes locally
git add .
git commit -m "feat: add new feature"
git push origin main
# CI/CD automatically redeploys!
```

### Method 2: Manual Redeploy

**Vercel:**
```bash
cd webapp/frontend
vercel --prod
```

**Railway:**
```bash
cd webapp/backend
railway up
```

**Docker:**
```bash
docker-compose down
docker-compose up -d --build
```

---

## 🔧 Environment Variables

### Backend (.env)
```env
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
GROQ_API_KEY=your_groq_key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Setting Secrets in GitHub (for CI/CD)
1. Go to Repository → Settings → Secrets → Actions
2. Add these secrets:
   - `VERCEL_TOKEN`
   - `RAILWAY_TOKEN`
   - `API_URL` (your deployed backend URL)

---

## 🔄 Deployment Workflow

```
┌─────────────────────────────────────────────────────────┐
│                   YOUR WORKFLOW                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. LOCAL DEVELOPMENT                                   │
│     └── Make changes in VS Code                         │
│     └── Test locally (npm run dev / python main.py)    │
│                                                         │
│  2. COMMIT CHANGES                                      │
│     └── git add .                                       │
│     └── git commit -m "your message"                    │
│                                                         │
│  3. PUSH TO GITHUB                                      │
│     └── git push origin main                            │
│                                                         │
│  4. AUTOMATIC DEPLOYMENT (CI/CD)                        │
│     └── GitHub Actions triggers                         │
│     └── Tests run (if configured)                       │
│     └── Builds frontend & backend                       │
│     └── Deploys to Vercel/Railway/etc                   │
│                                                         │
│  5. LIVE IN ~2-5 MINUTES ✅                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Common Post-Deployment Tasks

### 1. Update Backend Code
```bash
# Edit your Python files
git add webapp/backend/
git commit -m "fix: update recommendation logic"
git push
# Auto-deploys in ~2 min
```

### 2. Update Frontend UI
```bash
# Edit your React/Next.js files
git add webapp/frontend/
git commit -m "feat: improve dashboard design"
git push
# Auto-deploys in ~3 min
```

### 3. Update Environment Variables

**Vercel:** Dashboard → Project → Settings → Environment Variables

**Railway:** Dashboard → Project → Variables

**Docker:** Update .env file, then `docker-compose up -d`

### 4. Rollback to Previous Version

**Vercel:**
```bash
vercel rollback
```

**Railway:**
Dashboard → Deployments → Click previous deployment → Rollback

**Git:**
```bash
git revert HEAD
git push
```

---

## 🔐 Security Notes for Production

1. **Never commit secrets** - Use environment variables
2. **Enable 2FA** on all deployment platforms
3. **Use HTTPS** (automatic on Vercel/Railway)
4. **Set up monitoring** (Vercel Analytics, Railway Metrics)
5. **Configure rate limiting** (already implemented in backend)

---

## 📊 Monitoring Your Deployment

### Vercel (Frontend)
- Real-time analytics at vercel.com/dashboard
- View deployment logs
- Performance insights

### Railway (Backend)
- View logs: `railway logs`
- Monitor resources in dashboard
- Set up alerts

### Custom Monitoring
Consider adding:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **Uptime Robot** for availability monitoring

---

## 💡 Pro Tips

1. **Use Preview Deployments**: Push to a branch other than `main` to get a preview URL before going live

2. **Database Backups**: If using a database, set up automatic backups

3. **Feature Flags**: Use environment variables to enable/disable features without redeploying

4. **Blue-Green Deployment**: Keep the old version running while deploying new one, switch when ready

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- GitHub Actions: https://docs.github.com/en/actions
