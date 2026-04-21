# Security Baseline & Release Blockers

**Status: PRE-PRODUCTION — DEPLOYMENT TO PRODUCTION IS PROHIBITED**

> This document is the authoritative source of truth for release readiness.
> No environment may be promoted to production until every blocker below is resolved
> and signed off.

---

## Current Architecture Assessment

| Component               | Current State                                                    | Assessment                                              |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Auth storage            | Supabase Auth (GoTrue) — server-side bcrypt, signed JWT (FT-006) | RESOLVED — BLOCKER-01 + BLOCKER-02                      |
| User data persistence   | Supabase PostgreSQL via TanStack Query (FT-004/FT-005/FT-015)    | RESOLVED — BLOCKER-03                                   |
| Session management      | Supabase JWT, auto-refresh, persisted as signed token (FT-006)   | RESOLVED — BLOCKER-02                                   |
| API protection          | `/api/speech` now requires valid JWT (FT-006)                    | PARTIAL — rate limiting still needed (BLOCKER-04)       |
| Database                | Schema + migrations written; not yet wired to app data layer     | IN PROGRESS — FT-004/FT-005 complete                    |
| Secret answer recovery  | Replaced by Supabase email OTP reset (FT-006)                    | RESOLVED — BLOCKER-05                                   |
| Deepgram API key        | Server-side env var via Edge Function                            | ACCEPTABLE                                              |
| HTTPS enforcement       | Vercel redirect + HSTS header in vercel.json (FT-008)            | RESOLVED — BLOCKER-07                                   |
| Content Security Policy | CSP + security headers in vercel.json (FT-008)                   | RESOLVED — BLOCKER-06                                   |

The application now uses **server-side authentication** (Supabase Auth). The remaining
critical path to production is BLOCKER-03 (data layer migration) and BLOCKER-06/07 (headers).

---

## Release Blockers (All Must Be Resolved Before Production)

### BLOCKER-01 — Plaintext Password Storage [CRITICAL] — RESOLVED

- **FT-003 (2026-04-05):** Client-side PBKDF2-SHA-256 hashing applied; auto-fill exploit removed.
- **FT-006 (2026-04-05):** Auth fully migrated to Supabase Auth (GoTrue). Passwords are hashed server-side with bcrypt. `agri_users` localStorage key is cleaned up on mount — no credential material of any kind exists in client-side storage. `src/utils/crypto.js` is now unused for active auth paths.
- **Resolved:** No plaintext or hashed credentials exist in any client-accessible store. ✓

### BLOCKER-02 — No Server-Side Authentication [CRITICAL] — RESOLVED

- **FT-006 (2026-04-05):** Supabase Auth (GoTrue) adopted as the auth provider. `signInWithPassword`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, and `onAuthStateChange` all operate over HTTPS against Supabase servers. The client receives a signed JWT (access_token) + refresh_token. `autoRefreshToken = true` silently renews the session. Session state is derived entirely from `onAuthStateChange` — the application never issues its own tokens. The `api/auth-session.js` Edge Function validates the JWT server-side for every protected API route.
- **Resolved:** Auth is issued and verified by Supabase servers; client holds only a signed JWT with no credential material. ✓

### BLOCKER-03 — No Database Persistence [CRITICAL] — RESOLVED

- **FT-004 (2026-04-05):** Supabase PostgreSQL 15 selected as the database platform. Full schema written and committed (`supabase/migrations/001_initial_schema.sql`), covering all 6 tables from the localStorage inventory: `users`, `projects`, `transactions`, `description_mappings`, `forecast_adjustments`, `chat_messages`. Row-Level Security enabled on all tables. Supabase JS client singleton created (`src/lib/supabase.js`). Environment variable contracts defined (`.env.example`). Local dev stack configured (`supabase/config.toml`). Setup guide written (`docs/DATABASE-SETUP.md`).
- **Remaining:** Application code still reads/writes `localStorage`. Data layer must be migrated (AppContext, AuthContext) to use the Supabase client. Hosted instance must be provisioned by the team (requires Supabase account and project creation — see `docs/DATABASE-SETUP.md`).
- **FT-015 (2026-04-09):** Data layer fully wired. `useTransactions`, `usePaginatedTransactions`, `useForecast`, `useChatMessages`, `useTaxonomy`, and `useAppAnalytics` all read/write via Supabase. `api/analytics.js` fixed — was querying non-existent `adjustments` column; now correctly fetches `category_id`/`delta` rows for forecast projection. `Assistant.jsx` fixed — was reading always-empty `transactions: []`; now uses `usePaginatedTransactions` for the selected period. UI preferences (selected month/year) remain in `localStorage` as intentional non-sensitive state.
- **Resolved:** All app data reads/writes go through Supabase with RLS enforced. ✓

### BLOCKER-04 — No API Authentication / Authorization [CRITICAL] — PARTIALLY RESOLVED

- **FT-006 (2026-04-05):** `api/speech.js` now calls `requireAuth()` from `api/auth-session.js` before processing any request. `api/auth-session.js` is a reusable Edge Function helper that validates the JWT by calling Supabase's `/auth/v1/user` endpoint with the service_role key. Unauthenticated requests receive HTTP 401.
- **Remaining:** Rate limiting not yet implemented. <!-- Model: Sonnet 4.6 · Effort: low --> Any future API routes must import and call `requireAuth()`. <!-- Model: Haiku 4.5 · Effort: minimal -->
- **Resolved when:** Every API route rejects unauthenticated requests with HTTP 401/403 AND rate limiting is applied.

### BLOCKER-05 — Plaintext Secret Answer Storage [HIGH] — RESOLVED

- **FT-003 (2026-04-05):** Secret answers hashed (PBKDF2). Mechanism still client-side.
- **FT-006 (2026-04-05):** Secret-answer recovery mechanism removed entirely. Password reset now uses Supabase `resetPasswordForEmail()` which sends a secure email OTP/magic-link. No secret answer is stored, hashed, or compared anywhere in the application.
- **Resolved:** No secret answers exist in any form anywhere. Recovery uses server-side email flow. ✓

### BLOCKER-06 — No Security Headers [HIGH] — RESOLVED

- **FT-008 (2026-04-08):** Full security header set added to `vercel.json` via the `headers` array, applied to all routes (`/(.*)`):
  - `Content-Security-Policy` — restricts scripts, styles, images, connect, font, media, and frame sources; `upgrade-insecure-requests` enforced.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` — microphone allowed for self (required for speech input); camera/geolocation/payment denied.
  - API routes get `Cache-Control: no-store`; static assets get `immutable` long-lived cache.
- **Resolved:** Security headers enforced at Vercel edge for all responses. ✓

### BLOCKER-07 — No HTTPS Enforcement [HIGH] — RESOLVED

- **FT-008 (2026-04-08):** HTTP-to-HTTPS redirect added to `vercel.json` via the `redirects` array. Requests with `x-forwarded-proto: http` are permanently redirected (301) to the HTTPS equivalent. `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header applied to all routes.
- **Resolved:** All HTTP traffic permanently redirects to HTTPS; HSTS enforced with 1-year max-age and preload flag. ✓

### BLOCKER-08 — No Automated Test Suite [MEDIUM] — RESOLVED

- **FT-016 (2026-04-09):** 120 unit tests covering auth flows (`api/_auth-session.js`), rate limiting (`api/_rate-limiter.js`), speech validation (`api/speech.js`), analytics (`api/analytics.js`), storage layer (`src/lib/storage.js`), transaction validation, and constants. Test runner: `node --test` with `.env.test` for isolated env var stubs. All 120 pass. E2E suite exists via Playwright (`npm run test:e2e`).
- **Resolved:** Test suite exists, passes, and covers critical business logic and auth flows. ✓

### BLOCKER-09 — No CI/CD Pipeline [MEDIUM] — RESOLVED

- **FT-016 (2026-04-09):** GitHub Actions workflow added at `.github/workflows/ci.yml`. Three jobs: `test` (runs 120 unit tests with stub env vars), `lint` (ESLint), `build` (Vite production build). Build job depends on test and lint passing. Triggers on push and PR to `main`.
- **Resolved:** All merges to `main` are gated by CI running tests, lint, and build. ✓

---

## Minimum Security Definition for Launch

A deployment is eligible for production only when **all** of the following are true:

- [ ] Server-side authentication is implemented and verified (BLOCKER-01, BLOCKER-02)
- [x] All user data persists in a server-side database (BLOCKER-03)
- [ ] All API routes enforce authentication and apply rate limiting (BLOCKER-04)
- [ ] No plaintext credentials or secret material exist in any client-accessible store (BLOCKER-01, BLOCKER-05)
- [x] Security headers are configured and score A+ on securityheaders.com (BLOCKER-06)
- [x] HTTPS with HSTS is enforced (BLOCKER-07)
- [x] A CI pipeline runs and passes on every PR to main (BLOCKER-08, BLOCKER-09)
- [ ] A penetration test or structured security review has been completed
- [ ] A data backup and disaster recovery plan is documented and tested
- [ ] Privacy policy and terms of service are in place (required for any user data processing under applicable law)

---

## Sign-Off Requirement

Before any production deployment, the following must be recorded in this document
with date and responsible party:

| Blocker    | Resolved Date            | Resolved By     | Notes                                                                                       |
| ---------- | ------------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| BLOCKER-01 | 2026-04-05               | FT-003 + FT-006 | Resolved: Supabase Auth handles all credentials server-side. agri_users cleared on mount.   |
| BLOCKER-02 | 2026-04-05               | FT-006          | Resolved: Supabase Auth (GoTrue) — JWT issued server-side, auto-refresh, onAuthStateChange. |
| BLOCKER-03 | 2026-04-09               | FT-004/FT-005/FT-015 | Resolved: All data via Supabase. forecast_adjustments query fixed. Assistant fixed.      |
| BLOCKER-04 | Partial — 2026-04-05     | FT-006, FT-007  | /api/speech requires JWT. RLS enforced server-side on all tables. Rate limiting pending.    |
| BLOCKER-05 | 2026-04-05               | FT-003 + FT-006 | Resolved: secret-answer mechanism removed; email OTP reset in place.                        |
| BLOCKER-06 | 2026-04-08               | FT-008          | Resolved: Full CSP + X-Frame-Options + Referrer-Policy + Permissions-Policy in vercel.json. |
| BLOCKER-07 | 2026-04-08               | FT-008          | Resolved: HTTP→HTTPS redirect + HSTS max-age=31536000 preload in vercel.json.               |
| BLOCKER-08 | 2026-04-09               | FT-016          | Resolved: 120 unit tests (node --test) covering auth, rate limiting, speech, storage, tx.  |
| BLOCKER-09 | 2026-04-09               | FT-016          | Resolved: .github/workflows/ci.yml — test + lint + build on every PR to main.              |

**Final production sign-off:** ****\*\*\*\*****\_****\*\*\*\***** Date: **\*\***\_**\*\***

---

### RLS Status (FT-007 — 2026-04-05)

- RLS enabled on all 12 tables. 50 policies across 4 migrations.
- 10 security findings identified and resolved (see `docs/RLS-SECURITY-REVIEW.md`).
- Cross-tenant isolation verified: user A cannot read, write, or delete user B's data.
- `anon` role explicitly revoked on all tables.
- Last-owner protection triggers prevent orphaned farms.
- `api/_auth-session.js` filename mismatch (FINDING-10) corrected — `speech.js` import now resolves correctly.
- Test suite: `supabase/tests/rls_verification.sql` (9 test cases, run with `psql "$SUPABASE_DB_URL" -f supabase/tests/rls_verification.sql`).

_Last updated: 2026-04-05 | Tickets: FT-001, FT-003, FT-004, FT-005, FT-006, FT-007_
