# GitLab CI/CD Runner Setup Guide

## Overview
A GitLab Runner is the infrastructure component that executes CI/CD jobs defined in your `.gitlab-ci.yml`. This guide covers setting up your own runner for automated testing, building, and deployment.

## Why Your Own Runner?
- **Self-hosted runners** give you full control over the environment
- **Cost-effective** for private projects (vs. shared GitLab runners with minute limits)
- **Customizable** - install any dependencies or tools you need
- **Faster** - no wait time in shared runner queues
- **Docker executor** - runs jobs in isolated containers for consistent, reproducible builds

## Docker Runner (Recommended for isolation)

If you prefer stronger isolation and reproducible environments, use the Docker executor. Jobs run inside containers (not directly on the host), which reduces risk and keeps builds consistent across machines.

### Prerequisites
- Install Docker Desktop for Windows (enable WSL2 backend if prompted).
- Install GitLab Runner binary as below.

### Step 1: Download GitLab Runner
```powershell
# Download runner executable
Invoke-WebRequest -Uri "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-windows-amd64.zip" -OutFile "gitlab-runner-windows-amd64.zip"

# Extract to Program Files
Expand-Archive gitlab-runner-windows-amd64.zip -DestinationPath "C:\GitLab-Runner"
cd C:\GitLab-Runner
```

### Step 2: Verify Docker is Running
```powershell
docker version
```

If Docker is not running, open Docker Desktop and ensure it starts successfully.

### Step 3: Register the Runner (Docker executor)
```powershell
# From C:\GitLab-Runner directory - interactive registration
.\gitlab-runner.exe register
```

When prompted, provide:
- **GitLab instance URL**: `https://gitlab.com` (or your GitLab instance)
- **GitLab registration token**: Get from your GitLab project → Settings → CI/CD → Runners
- **Runner description**: `group35stripe-docker-runner`
- **Tags**: `docker`, `next.js` (comma-separated)
- **Executor**: `docker`
- **Default Docker image**: `node:20` or `node:20-alpine`

For non-interactive registration use the `--non-interactive` flags and set `--executor docker --docker-image node:20`.

### Step 4: Install and Start as Windows Service
```powershell
.\gitlab-runner.exe install --user SYSTEM --password ""
.\gitlab-runner.exe start
```

Verify runner status:
```powershell
.\gitlab-runner.exe status
```

---

## Your `.gitlab-ci.yml` Configuration

Your project already has an updated `.gitlab-ci.yml` file ready to use:

See the `.gitlab-ci.yml` file in the repository root for the full, up-to-date pipeline configuration. It includes:

- **image**: `node:20` (default Docker image for all jobs)
- **lint**: Runs ESLint via `npm ci` + `npm run lint`
- **build**: Compiles Next.js via `npm ci` + `npm run build`, stores `.next/` as artifact
- **deploy_preview**: Manual Vercel preview deployment for MRs/develop
- **deploy_production**: Manual Vercel production deployment for main
- All jobs tagged with `docker` to run on your Docker runner

---

## Configuration Files

### Runner Config Location
- **Windows**: `C:\ProgramData\GitLab-Runner\config.toml`

The configuration file is created automatically during registration. The `config.toml` for a Docker runner will include a `[runners.docker]` section describing image settings and volumes; you typically don't need to edit it for basic setups.

---

## GitLab Variables Setup

In your GitLab project, add these variables (`Settings → CI/CD → Variables`):

| Variable | Value | Masked | Protected |
|----------|-------|--------|-----------|
| `VERCEL_TOKEN` | Your Vercel API token | ✓ | ✓ |
| `VERCEL_ORG_ID` | From `.vercel/project.json` | ✓ | ✓ |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` | ✓ | ✓ |

---

## Verify Your Runner is Working

### 1. Check Runner Status
```powershell
cd C:\GitLab-Runner
.\gitlab-runner.exe status
```

Should show: `<runner-id> ... status    online`

### 2. Check in GitLab UI
- Go to your project → **Settings → CI/CD → Runners**
- Your runner should appear and show **online** status

### 3. Test with a Commit
- Push a commit to any branch
- Go to **CI/CD → Pipelines**
- Click the pipeline to see it run
- Should see lint, build stages executing on your runner

---

## Troubleshooting

### Runner shows "offline"
```powershell
# Check runner status
.\gitlab-runner.exe status

# Stop and restart
.\gitlab-runner.exe stop
.\gitlab-runner.exe start

# View logs
Get-Content "C:\ProgramData\GitLab-Runner\system.log" -Tail 50
```

### Jobs stuck in "pending"
- Ensure runner tags in `.gitlab-ci.yml` match runner tags in registration
- Check that `GITLAB_CI_TOKEN` is valid in runner config

### npm module caching issues
Ensure your cache key is unique per branch:
```yaml
cache:
  key: "$CI_COMMIT_REF_SLUG"  # Different cache per branch
  paths:
    - node_modules/
```

### Windows path issues in scripts
Use forward slashes in paths or PowerShell syntax:
```yaml
script:
  - npm ci
  - npm run build
```

---

## Next Steps

1. **Register runner** using the steps above
2. **Verify it's online** in GitLab project settings
3. **Push a test commit** to trigger the pipeline
4. **Monitor the first pipeline run**
5. **Adjust .gitlab-ci.yml** as needed for your team
6. **Add testing** when you have test suites ready

---

## Security Considerations

- ✓ Use **protected variables** for secrets
- ✓ Set runner to **protected** in CI/CD settings if only for main branches
- ✓ Use **tags** to route sensitive jobs only to trusted runners
- ✓ Regularly update GitLab Runner: `.\gitlab-runner.exe --version`
- ✓ Keep Node.js and dependencies up to date

---

## Resources

- [GitLab Runner Documentation](https://docs.gitlab.com/runner/)
- [GitLab CI/CD Configuration](https://docs.gitlab.com/ee/ci/yaml/)
- [Shell Executor Guide](https://docs.gitlab.com/runner/executors/shell.html)
