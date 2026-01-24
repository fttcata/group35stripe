# Vercel Deployment Setup

This project is configured for automatic deployment to Vercel via GitLab CI/CD.

## Required GitLab CI/CD Variables

You need to add the following variables in your GitLab project settings (`Settings > CI/CD > Variables`):

### 1. Get Vercel Token
```bash
npx vercel login
npx vercel token create
```
- Add as: `VERCEL_TOKEN` (masked, protected)

### 2. Get Project IDs
First, link your project locally:
```bash
npx vercel link
```

Then retrieve the IDs from `.vercel/project.json`:
```bash
cat .vercel/project.json
```

Add these variables to GitLab:
- `VERCEL_ORG_ID` - Your organization/team ID (masked)
- `VERCEL_PROJECT_ID` - Your project ID (masked)

## Deployment Flow

- **Main branch** → Production deployment
- **Develop/MR branches** → Preview deployment

## Manual Deployment (Local)

```bash
# Preview deployment
npx vercel

# Production deployment
npx vercel --prod
```
