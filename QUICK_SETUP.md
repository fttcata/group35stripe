# GitLab CI/CD Docker Runner — Quick Setup

## Prerequisites
✓ Docker Desktop installed and running  
✓ GitLab project registration token (from **Settings → CI/CD → Runners**)

## Install & Register (PowerShell as Admin)

```powershell
# Download and extract
Invoke-WebRequest -Uri "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-windows-amd64.zip" -OutFile "gitlab-runner-windows-amd64.zip"
Expand-Archive gitlab-runner-windows-amd64.zip -DestinationPath "C:\GitLab-Runner"
Set-Location "C:\GitLab-Runner"

# Register (interactive - follow prompts below)
.\gitlab-runner.exe register

# When prompted, enter:
# - URL: https://gitlab.com/
# - Token: <paste your registration token>
# - Description: group35stripe-docker-runner
# - Tags: docker,next.js
# - Executor: docker
# - Default Docker image: node:20

# Install as Windows service and start
.\gitlab-runner.exe install --user SYSTEM --password ""
.\gitlab-runner.exe start

# Verify
.\gitlab-runner.exe status
```

## Verify in GitLab
- Go to **Settings → CI/CD → Runners**
- Your runner should appear with **"online"** status
- Push a test commit to trigger the pipeline

## Done
CI/CD pipeline will now run automatically on lint, build, and deploy stages!

---
For detailed setup help, see [GITLAB_RUNNER_SETUP.md](GITLAB_RUNNER_SETUP.md)
