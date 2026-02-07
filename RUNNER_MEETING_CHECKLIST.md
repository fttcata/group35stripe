# GitLab CI/CD Runner - Meeting Checklist

## Pre-Meeting Setup Checklist ✓

- ### 1. Documentation Ready
- [x] `GITLAB_RUNNER_SETUP.md` - Docker runner setup guide for Windows
- [x] `.gitlab-ci.yml` - Active lint, build, and deploy stages
- [x] This checklist for the meeting

### 2. What's Ready to Deploy

#### Current CI/CD Stages
- **Lint Stage**: Runs ESLint on all MRs and main branches
- **Build Stage**: Compiles Next.js application, generates artifacts
- **Deploy Stages**: 
  - Preview deployment (manual trigger for MRs)
  - Production deployment (manual trigger for main branch)

#### Environment Variables Configured
- `VERCEL_TOKEN` (for Vercel API access)
- `VERCEL_ORG_ID` (your org ID)
- `VERCEL_PROJECT_ID` (your project ID)

### 3. Setup Decision Made ✓

- [x] **Executor Choice**: Docker Runner selected
  - Runs jobs in containers for better isolation
  - Requires Docker Desktop on the host machine
  
- [ ] **Where to Host Runner**?
  - Option A: Local Windows machine (dev environment - recommended to start)
  - Option B: Dedicated Windows Server (for production/always-on)

- [ ] **Deployment Triggers**
  - Currently set to `manual` (click button to deploy)
  - Could change to `automatic` for main/develop branches

- [ ] **Testing Integration**
  - Add Jest/Vitest tests to package.json
  - Create test stage in `.gitlab-ci.yml`

### 4. Quick Start Commands (for team)

```powershell
# 1. Download GitLab Runner
Invoke-WebRequest -Uri "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-windows-amd64.zip" -OutFile "gitlab-runner-windows-amd64.zip"
Expand-Archive gitlab-runner-windows-amd64.zip -DestinationPath "C:\GitLab-Runner"
cd C:\GitLab-Runner

# 2. Register Runner (Docker Executor)
.\gitlab-runner.exe register
# When prompted:
#   - URL: https://gitlab.com
#   - Token: (get from GitLab project settings)
#   - Description: group35stripe-docker-runner
#   - Tags: docker, next.js
#   - Executor: docker
#   - Default image: node:20

# 3. Install as Windows Service
.\gitlab-runner.exe install --user SYSTEM --password ""
.\gitlab-runner.exe start

# 4. Verify it's online
.\gitlab-runner.exe status
```

### 5. Advantages of Self-Hosted Runner

✓ **Cost Savings**
- Free minutes for shared runners are limited
- Own runner = unlimited pipeline minutes

✓ **Better Performance**
- No queue time
- Direct access to your development environment
- Faster npm caching

✓ **Full Control**
- Install any tools needed (Stripe CLI, testing frameworks)
- Cache large dependencies locally
- Run long-running jobs without limits

✓ **Security**
- Keep secrets on your own infrastructure
- No shared state with other projects

### 6. Common Setup Issues & Fixes

| Issue | Solution |
|-------|----------|
| Runner shows "offline" | Check firewall allows HTTPS. Restart with `gitlab-runner start` |
| Jobs stay "pending" | Ensure runner tags match job tags in `.gitlab-ci.yml` |
| npm install hangs | Check internet connection. Use `npm ci` instead of `npm install` |
| Out of disk space | Clean runner cache: `gitlab-runner prune` |

### 7. Next Team Actions

1. **Decide hosting location**: Local machine or dedicated server?
2. **Get GitLab registration token** from project Settings → CI/CD → Runners
3. **Run registration script** following the Quick Start Commands above
4. **Verify runner appears online** in GitLab UI
5. **Make a test commit** to trigger the first pipeline
6. **Monitor and adjust** based on pipeline runs

### 8. Resources to Share

- Full Setup Guide: `GITLAB_RUNNER_SETUP.md` (in repo)
- CI/CD Configuration: `.gitlab-ci.yml` (in repo)
- GitLab Runner Docs: https://docs.gitlab.com/runner/
- Your Project CI/CD Settings: https://gitlab.com/[your-project]/-/settings/ci_cd

---

## Meeting Discussion Points

1. **Timeline**: When should runner be live? (Before final sprint?)
2. **Team Role**: Who manages the runner machine? (Should it always be on?)
3. **Testing**: Do we add automated tests in this iteration?
4. **Deployment**: Auto-deploy on main branch, or manual trigger?
5. **Monitoring**: How to track pipeline success/failures?

---

**Prepared**: February 7, 2026
**Status**: Ready for deployment
