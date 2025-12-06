# Dependabot Setup Guide

This guide walks you through enabling Dependabot on your GitHub repository to automate dependency updates and security patches.

## What is Dependabot?

Dependabot automatically:
- 🔍 Scans your dependencies for security vulnerabilities
- 📦 Creates pull requests to update outdated packages
- 🔐 Alerts you about security advisories
- ⚡ Keeps your dependencies up-to-date with minimal effort

## Step 1: Enable Dependabot Security Updates

1. Go to your repository: `https://github.com/raed-saidi/odyssey`
2. Click **Settings** tab
3. Click **Code security and analysis** (left sidebar)
4. Enable these features:
   - ✅ **Dependency graph** (should already be enabled)
   - ✅ **Dependabot alerts** - Click "Enable"
   - ✅ **Dependabot security updates** - Click "Enable"

## Step 2: Create Dependabot Configuration File

Create `.github/dependabot.yml` in your repository:

```yaml
# .github/dependabot.yml
version: 2

updates:
  # ==========================================
  # Python Dependencies (Root)
  # ==========================================
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "python"
      - "automerge"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps"
      prefix-development: "deps-dev"
      include: "scope"
    groups:
      # Group ML/Data Science packages
      ml-packages:
        patterns:
          - "numpy"
          - "pandas"
          - "scikit-learn"
          - "xgboost"
      # Group API client packages
      api-clients:
        patterns:
          - "groq"
          - "yfinance"
          - "fredapi"
          - "alpaca-py"
      # Group infrastructure packages
      infrastructure:
        patterns:
          - "zenml"
          - "mlflow"
          - "qdrant-client"

  # ==========================================
  # Backend Python Dependencies
  # ==========================================
  - package-ecosystem: "pip"
    directory: "/webapp/backend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "python"
      - "backend"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps(backend)"
      include: "scope"
    groups:
      # Group web framework packages
      web-framework:
        patterns:
          - "fastapi"
          - "uvicorn"
          - "pydantic"
          - "python-multipart"
      # Group RL/ML packages
      rl-packages:
        patterns:
          - "torch"
          - "stable-baselines3"
          - "gymnasium"

  # ==========================================
  # Frontend NPM Dependencies
  # ==========================================
  - package-ecosystem: "npm"
    directory: "/webapp/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "10:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "javascript"
      - "frontend"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps(frontend)"
      prefix-development: "deps-dev(frontend)"
      include: "scope"
    versioning-strategy: "increase"
    groups:
      # Group Next.js and React
      nextjs-react:
        patterns:
          - "next"
          - "react"
          - "react-dom"
          - "eslint-config-next"
      # Group testing libraries
      testing:
        patterns:
          - "jest"
          - "@testing-library/*"
          - "@types/jest"
      # Group UI libraries
      ui-libraries:
        patterns:
          - "lucide-react"
          - "recharts"
          - "framer-motion"
          - "lightweight-charts"
      # Group dev tools
      dev-tools:
        patterns:
          - "typescript"
          - "tailwindcss"
          - "autoprefixer"
          - "postcss"

  # ==========================================
  # Docker Base Images
  # ==========================================
  - package-ecosystem: "docker"
    directory: "/webapp/backend"
    schedule:
      interval: "weekly"
      day: "tuesday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "docker"
      - "backend"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps(docker)"

  - package-ecosystem: "docker"
    directory: "/webapp/frontend"
    schedule:
      interval: "weekly"
      day: "tuesday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "docker"
      - "frontend"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps(docker)"

  # ==========================================
  # GitHub Actions
  # ==========================================
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "wednesday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 3
    labels:
      - "dependencies"
      - "github-actions"
      - "ci-cd"
    reviewers:
      - "raed-saidi"
    commit-message:
      prefix: "deps(actions)"
```

## Step 3: Configure Branch Protection Rules

Set up branch protection to ensure Dependabot PRs are tested before merge:

1. Go to **Settings** → **Branches**
2. Click **Add rule** for `main` branch
3. Configure these settings:

   **Required:**
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Select: `python-quality`, `python-tests`, `frontend-quality`, `frontend-tests`
   - ✅ Require conversation resolution before merging
   
   **Recommended:**
   - ✅ Require signed commits
   - ✅ Include administrators (apply to everyone)
   - ⬜ Allow force pushes (leave unchecked)
   - ⬜ Allow deletions (leave unchecked)

## Step 4: Set Up Auto-Merge (Optional)

For low-risk updates, enable auto-merge:

1. Install GitHub CLI: `gh auth login`
2. Enable auto-merge for patch updates:

```bash
# Create a workflow to auto-approve Dependabot PRs
# .github/workflows/dependabot-auto-merge.yml
```

Create this file:

```yaml
name: Dependabot Auto-Merge

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"
      
      - name: Auto-approve patch and minor updates
        if: |
          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
          steps.metadata.outputs.update-type == 'version-update:semver-minor'
        run: |
          gh pr review --approve "$PR_URL"
          gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Label major updates for manual review
        if: steps.metadata.outputs.update-type == 'version-update:semver-major'
        run: |
          gh pr edit "$PR_URL" --add-label "major-update,manual-review"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Step 5: Test Dependabot

Trigger a manual Dependabot check:

```bash
# Use GitHub CLI
gh api -X POST /repos/raed-saidi/odyssey/dependabot/alerts

# Or wait for the scheduled run (weekly Monday 9 AM)
```

## Step 6: Review and Merge Dependabot PRs

When Dependabot creates PRs:

1. **Review the changes**
   - Check the release notes
   - Review breaking changes
   - Look at test results in CI/CD

2. **Test locally** (for major updates)
   ```bash
   # Checkout the PR branch
   gh pr checkout <PR_NUMBER>
   
   # Run tests
   pytest
   npm test
   
   # Build and test containers
   docker-compose up --build
   ```

3. **Merge the PR**
   - Patch updates: Auto-merge ✅
   - Minor updates: Review + merge 👀
   - Major updates: Thorough testing + manual merge 🧪

## Dependabot Schedule Summary

| Ecosystem | Day | Time | Max PRs | Strategy |
|-----------|-----|------|---------|----------|
| Python (root) | Monday | 9:00 AM | 5 | Grouped by category |
| Python (backend) | Monday | 9:00 AM | 5 | Grouped by category |
| NPM (frontend) | Monday | 10:00 AM | 5 | Grouped by category |
| Docker | Tuesday | 9:00 AM | 3 | Individual PRs |
| GitHub Actions | Wednesday | 9:00 AM | 3 | Individual PRs |

**Total**: Max 21 PRs per week (typically 5-10 in practice)

## Grouping Strategy Explained

Dependabot will create **one PR per group** instead of separate PRs for each package:

**Example:**
- ❌ Without grouping: 5 separate PRs for numpy, pandas, scikit-learn, xgboost, scipy
- ✅ With grouping: 1 PR updating all ML packages together

This reduces PR noise and makes reviewing easier.

## Security vs Version Updates

### Security Updates (Immediate)
- Triggered when GitHub Security Advisory is published
- Created immediately (not waiting for schedule)
- Labeled with `security`
- Should be merged ASAP after testing

### Version Updates (Scheduled)
- Run on schedule (weekly Monday)
- Update to latest versions within constraints
- Labeled with `dependencies`
- Can be merged on normal review cycle

## Ignoring Specific Dependencies

If you want to exclude certain packages from updates:

```yaml
# .github/dependabot.yml
- package-ecosystem: "pip"
  directory: "/"
  schedule:
    interval: "weekly"
  ignore:
    # Ignore major version updates for torch (breaking changes)
    - dependency-name: "torch"
      update-types: ["version-update:semver-major"]
    
    # Ignore all updates for stable-baselines3 (testing v3 separately)
    - dependency-name: "stable-baselines3"
    
    # Ignore patch updates for numpy (too noisy)
    - dependency-name: "numpy"
      update-types: ["version-update:semver-patch"]
```

## Monitoring Dependabot

### View Active Alerts
```bash
# List all Dependabot alerts
gh api /repos/raed-saidi/odyssey/dependabot/alerts

# View specific alert
gh api /repos/raed-saidi/odyssey/dependabot/alerts/{alert_number}
```

### Check Update Status
1. Go to **Insights** → **Dependency graph** → **Dependabot**
2. View:
   - Last check time
   - Pending updates
   - Failed update attempts

## Troubleshooting

### Issue: Dependabot PRs failing CI/CD

**Solution:**
```yaml
# Add Dependabot to allowed PR creators in workflows
on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

jobs:
  test:
    # Run for all PRs, including Dependabot
    if: github.actor != 'dependabot[bot]' || github.event_name == 'pull_request'
```

### Issue: Too many PRs created

**Solution:**
- Reduce `open-pull-requests-limit` to 3
- Increase grouping (combine more packages)
- Change schedule from daily to weekly

### Issue: Updates breaking tests

**Solution:**
- Add `ignore` rules for problematic packages
- Pin versions in requirements.txt with upper bounds
- Improve test coverage before enabling auto-merge

## Best Practices

1. **Start Conservative**
   - Begin with manual review for all PRs
   - Enable auto-merge only after 1 month of testing
   - Group updates by logical categories

2. **Monitor Closely**
   - Check Dependabot activity weekly
   - Review security alerts daily
   - Keep an eye on CI/CD failure rates

3. **Update Regularly**
   - Don't let PRs accumulate (max 1-2 weeks old)
   - Merge security updates within 48 hours
   - Review major updates within 1 week

4. **Test Thoroughly**
   - Run full test suite for all updates
   - Check Docker builds succeed
   - Verify deployments to staging before production

## Verification Checklist

- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] `.github/dependabot.yml` created and committed
- [ ] Branch protection rules configured
- [ ] Auto-merge workflow set up (optional)
- [ ] Tested with manual trigger
- [ ] Reviewed first batch of PRs
- [ ] Documented merge policy for team
- [ ] Set up Slack/email notifications
- [ ] Monitored for 2 weeks before enabling auto-merge

## Cost

Dependabot is **completely free** for:
- ✅ Public repositories (unlimited)
- ✅ Private repositories (unlimited as of 2024)

## Next Steps

1. **Create `.github/dependabot.yml`** using the template above
2. **Enable Dependabot** in repository settings
3. **Set up branch protection** to require CI/CD checks
4. **Wait for first PRs** (scheduled Monday morning)
5. **Review and merge** the first batch manually
6. **Enable auto-merge** after testing (optional)

## References

- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Dependabot Configuration Options](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Auto-merge Dependabot PRs](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
