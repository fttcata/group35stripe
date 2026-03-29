# CI Test Cases (Sprint 1)

## Current CI coverage
- The current CI pipeline only runs a production build.
- There are no automated unit, integration, or end-to-end tests configured yet.

## Sprint 1 basic CI test cases
These are intentionally lightweight and meant to cover the whole codebase at a high level.

### CI-001: Dependency installation
**Goal:** Ensure the project installs cleanly in CI.
**Steps:**
1. Run `npm ci --legacy-peer-deps`.
**Expected result:** Install succeeds without errors.

### CI-002: Linting
**Goal:** Enforce code quality across the app and API routes.
**Steps:**
1. Run `npm run lint`.
**Expected result:** No ESLint errors.

### CI-003: Type checking
**Goal:** Catch TypeScript type errors in pages, components, and API routes.
**Steps:**
1. Run `npx tsc --noEmit`.
**Expected result:** No TypeScript errors.

### CI-004: Next.js build
**Goal:** Verify the entire app (pages, components, API routes) compiles.
**Steps:**
1. Set required env placeholders (Stripe + Supabase).
2. Run `npm run build`.
**Expected result:** Build completes successfully.

### CI-005: Static route compilation smoke check
**Goal:** Ensure key routes compile without runtime-only errors.
**Scope:**
- `/` (home)
- `/events` and `/events/[slug]`
- `/eventDetails`
- `/buy`, `/success`, `/cancel`
- `/login`, `/register`, `/account`, `/submit-event`
**Expected result:** All routes included in the build output without compile errors.

### CI-006: API route compilation smoke check
**Goal:** Ensure API routes compile and are included in the build.
**Scope:**
- `/api/checkout`
- `/api/events`
- `/api/ticket-types`
- `/api/auth/callback`
- `/api/auth/signout`
**Expected result:** Build completes with no route handler compile errors.

### CI-007: Supabase client import check
**Goal:** Ensure Supabase client modules compile in both server and client contexts.
**Scope:**
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
**Expected result:** No build-time import or type errors.

### CI-008: Stripe server SDK import check
**Goal:** Ensure Stripe server SDK is properly used in server-only routes.
**Scope:**
- `/api/checkout` route
**Expected result:** Build completes with no server/client boundary errors.

## Additional CI test cases (Enhanced)

### CI-009: Security audit
**Goal:** Detect known vulnerabilities in dependencies.
**Steps:**
1. Run `npm ci --legacy-peer-deps`.
2. Run `npm audit --audit-level=high`.
**Expected result:** No high or critical severity vulnerabilities reported.
**Notes:** Set to `allow_failure: true` to avoid blocking builds for low-risk issues.

### CI-010: Dependency check
**Goal:** Identify unused dependencies that bloat the project.
**Steps:**
1. Run `npm ci --legacy-peer-deps`.
2. Run `npx depcheck --ignores="@types/*,eslint-config-next,@tailwindcss/postcss"`.
**Expected result:** No unused dependencies found (excluding type definitions and build tools).
**Notes:** Helps maintain a clean package.json and reduce bundle size.

### CI-011: Environment variable security check
**Goal:** Prevent hardcoded API keys or secrets from being committed.
**Steps:**
1. Search source files for patterns like `sk_live_`, `pk_live_`, `rk_live_` (Stripe live keys).
2. Check app/, lib/, and other source directories.
**Expected result:** No hardcoded live API keys found.
**Notes:** Critical security check to prevent accidental secret exposure.

### CI-012: Build artifact generation
**Goal:** Generate and preserve build artifacts for downstream jobs.
**Steps:**
1. Complete successful build.
2. Save `.next/` directory as artifact.
**Expected result:** Artifacts available for 1 day, accessible by quality jobs.
**Notes:** Enables build size analysis and deployment validation.

### CI-013: Build size monitoring
**Goal:** Track and monitor the size of production builds.
**Steps:**
1. Use artifacts from build job.
2. Calculate total `.next/` directory size.
3. Report size metrics.
**Expected result:** Build size reported (informational).
**Notes:** Future enhancement: set size thresholds and fail if exceeded.

### CI-014: Package.json validation
**Goal:** Ensure package.json has required fields and valid structure.
**Steps:**
1. Parse package.json as JSON.
2. Verify presence of name, version, scripts, and dependencies fields.
**Expected result:** All required fields present and valid.
**Notes:** Catches malformed package.json before deployment.

### CI-015: Cache efficiency
**Goal:** Optimize CI pipeline performance using dependency caching.
**Steps:**
1. Cache `node_modules/` and `.next/cache/` directories.
2. Use branch-specific cache keys.
**Expected result:** Subsequent pipeline runs faster due to cache hits.
**Notes:** Reduces `npm ci` time and build compilation time.

### CI-016: Multi-stage pipeline execution
**Goal:** Verify security checks run before tests, tests before build, and quality checks after build.
**Steps:**
1. Trigger pipeline.
2. Observe stage execution order: security → test → build → quality.
**Expected result:** Stages execute in correct order; failures in early stages prevent later stages.
**Notes:** Optimizes CI time by failing fast on security or linting issues.

### CI-017: Parallel job execution
**Goal:** Maximize CI efficiency by running independent jobs in parallel.
**Steps:**
1. Observe security-audit and dependency-check run in parallel (security stage).
2. Observe lint and typecheck run in parallel (test stage).
**Expected result:** Parallel jobs complete faster than sequential execution.
**Notes:** Reduces total pipeline execution time.

### CI-018: Protected branch enforcement
**Goal:** Ensure CI runs on protected branches (main, production).
**Steps:**
1. Configure cache keys with `${CI_COMMIT_REF_SLUG}-protected`.
2. Push to protected branch.
**Expected result:** CI runs successfully with branch-specific cache.
**Notes:** Prevents cache poisoning across branches.

### CI-019: Merge conflict marker check
**Goal:** Catch unresolved merge conflicts before they reach build or deploy stages.
**Steps:**
1. Scan tracked source files for `<<<<<<<`, `=======`, or `>>>>>>>` markers.
2. Fail the job if any marker is found.
**Expected result:** No merge conflict markers exist in the repository.
**Notes:** Very fast and easy to implement with a single `grep` command.

### CI-020: Required file presence check
**Goal:** Ensure the project keeps the minimum files needed for build and deployment.
**Steps:**
1. Verify the presence of key files such as `package.json`, `package-lock.json`, `next.config.ts`, and `tsconfig.json`.
2. Verify critical API route files still exist.
**Expected result:** All required files are present.
**Notes:** Useful as a quick structural smoke test after refactors.

### CI-021: Environment template check
**Goal:** Ensure `.env.example` includes the core variables needed by contributors and CI.
**Steps:**
1. Check that `.env.example` exists.
2. Verify it contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_BASE_URL`.
**Expected result:** The environment template is present and includes the required keys.
**Notes:** Easy to implement with a small shell loop.

### CI-022: Database asset presence check
**Goal:** Ensure the committed SQL setup files required for local and CI setup are available.
**Steps:**
1. Verify `db/schema.sql`, `db/seeds.sql`, `db/profiles.sql`, and `db/guest_checkout.sql` exist.
**Expected result:** All expected database SQL files are present.
**Notes:** Lightweight guard against accidental file deletion.

## Notes
- These test cases are documented for Sprint 1; implementation can be staged later.
- Adding a minimal `test` script and a test runner can be deferred to Sprint 2+.
- Enhanced CI now includes security, quality, and monitoring jobs.
- The newest additions are intentionally low-cost shell-based checks suited for quick CI wins.
- Consider adding actual unit/integration tests in Sprint 2+ using Jest or Vitest.
