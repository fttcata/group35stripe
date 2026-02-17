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

## Notes
- These test cases are documented for Sprint 1; implementation can be staged later.
- Adding a minimal `test` script and a test runner can be deferred to Sprint 2+.
