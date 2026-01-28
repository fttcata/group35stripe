This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Automatic deployment (GitLab → GitHub mirror → Vercel)

This project is deployed automatically on every push using this flow:

- **GitLab (self-hosted)**: primary repo you push to
- **GitHub**: mirror destination (GitLab pushes here automatically)
- **Vercel**: connected to the GitHub repo and auto-deploys on new commits

### Step 1: Create the GitHub repository

- Create a new **public** GitHub repository (e.g. `group35stripe`)
- Copy the repo URL (example): `https://github.com/<username>/group35stripe.git`
- Create a GitHub Personal Access Token (classic):
  - GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
  - **Generate new token (classic)**
  - Scopes: **repo** (all)
  - Copy the token (you’ll use it in the mirror URL)

### Step 2: Set up the GitLab mirror (push direction)

In your GitLab project:

- Go to **Settings → Repository → Mirroring repositories**
- Configure:
  - **Git repository URL**:
    - `https://<YOUR_GITHUB_TOKEN>@github.com/<username>/group35stripe.git`
  - **Mirror direction**: **Push**
  - **Authentication method**: **Password** (leave password blank — token is in the URL)
- Click **Mirror repository**

**Quick test**

- Push a commit to GitLab (to your deployment branch, typically `main`)
- Verify the commit appears on GitHub within ~1 minute

### Step 3: Connect the GitHub repo to Vercel

- Go to Vercel and create a new project
- **Import Git Repository** → select your GitHub repo
- Configure:
  - **Framework Preset**: Next.js (auto-detected)
  - **Root Directory**: `./` (default)
  - **Build Command**: `npm run build` (default)

Add these **Environment Variables** in Vercel (Project → Settings → Environment Variables):

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Deploy, then copy the deployment URL.

### Step 4: Test end-to-end deployment

- Make a small change in GitLab (e.g. edit this `README.md`)
- Push to `main`
- Confirm:
  - GitHub mirror updates within ~1 minute
  - Vercel triggers a new deployment within ~2–3 minutes
  - The change appears at your Vercel URL

### Notes

- If Vercel isn’t deploying, confirm it’s connected to the **GitHub** repo (not GitLab) and that you’re pushing to the branch Vercel is set to deploy (commonly `main`).
- The `.gitlab-ci.yml` in this repo is currently a placeholder and is **not** required for the GitLab→GitHub mirror→Vercel flow.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
