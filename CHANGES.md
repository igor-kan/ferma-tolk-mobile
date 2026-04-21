# CHANGES

Last updated: 2026-04-19

## Summary
Implemented:
1. Forward DB migration and SQL verification for `farm_memberships` recursion (`42P17`).
2. Analytics UI resilience fixes for Dashboard/Reports runtime crashes when API analytics payload is unavailable or malformed.

## Files Added
- `supabase/migrations/010_fix_farm_memberships_rls_recursion.sql`
- `AGENTS.md`
- `TASKS.md`
- `RESEARCH.md`
- `PLAN.md`
- `CHANGES.md`
- `src/features/analytics/analyticsShape.js`
- `src/features/analytics/analyticsShape.test.js`

## Files Updated
- `supabase/tests/rls_verification.sql` (fixed harness assumptions + added/validated `T-10`)
- `src/features/analytics/useAppAnalytics.js` (API JSON validation, client fallback, payload normalization)
- `src/features/analytics/Reports.jsx` (defensive handling for non-array `cycleAnalytics`)

## Migration Details (`010_fix_farm_memberships_rls_recursion.sql`)
- Added `private` schema helper functions:
  - `private.is_farm_admin(UUID, UUID)`
  - `private.is_farm_owner(UUID, UUID)`
- Marked helper functions `SECURITY DEFINER` and restricted function execution to `authenticated`.
- Replaced recursive policies on `public.farm_memberships`:
  - `"memberships: admins see farm"`
  - `"memberships: admins can invite"`
  - `"memberships: admins can manage"`
  - `"memberships: owners can remove or self-leave"`

## Expected Effect
- Removes `42P17` recursion errors while preserving existing membership authorization semantics.
- Prevents `cycleAnalytics.map is not a function` runtime failures in Reports.
- Keeps analytics pages working in local Vite dev when `/api/analytics` is not executable JSON.

## Verification Run
- `npm run validate:migrations` ✅
- `supabase db reset --local --yes` ✅ (applied migrations through `010`)
- `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_verification.sql` ✅ (`T-01`..`T-10`)
- `supabase db push --linked --dry-run` ✅ (`010_fix_farm_memberships_rls_recursion.sql` pending)
- `supabase db push --linked` ✅ (applied `010` to linked project `znzaawjvuyavxqhsfrsp`)
- `supabase migration list --linked` ✅ (local/remote aligned through `010`)
- `npm test` ✅ (131/131)
- `npx eslint src/features/analytics/useAppAnalytics.js src/features/analytics/Reports.jsx src/features/analytics/analyticsShape.js src/features/analytics/analyticsShape.test.js` ✅
- `npm run lint` ⚠️ fails on unrelated pre-existing lint errors (not in files changed for this fix)

## Local/Remote Sync + Domain Checks (2026-04-19)
- Confirmed `localhost:5173` currently targets hosted Supabase via `.env.local` (`VITE_SUPABASE_URL=https://znzaawjvuyavxqhsfrsp.supabase.co`), not the local stack.
- `supabase db push` confirmed linked remote database schema is up to date.
- Exported remote data snapshot and synced it into local DB:
  - Dump file: `/tmp/ferma_remote_public_data_no_taxonomy.sql`
  - Local reset: `supabase db reset --local --no-seed --yes`
  - Import: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f /tmp/ferma_remote_public_data_no_taxonomy.sql`
  - Note: static taxonomy tables were excluded to avoid duplicate-key conflicts with migration-seeded rows.
- Verified production domain:
  - `https://ferma-tolk.youridea.live` returns `HTTP/2 200`.
  - `http://ferma-tolk.youridea.live` redirects to HTTPS (`308 Permanent Redirect`).
  - `https://ferma-tolk.youridea.live/api/analytics` returns expected `401 Unauthorized` without bearer token.
  - Supabase Auth recovery endpoint accepts production redirect URL `https://ferma-tolk.youridea.live/#recovery` (`POST /auth/v1/recover` → `200 {}`).
- Verified production build locally: `npm run build` ✅.

## Local vs Vercel Production Diagnosis (2026-04-19)
- Investigated reported mismatch: app works on `http://localhost:5173` but not on `https://ferma-tolk.youridea.live` (main + reports views).
- Live Vercel HTML currently references `/assets/index-BBXemOQE.js`.
- Current local production build generates `/assets/index-N73T0Xhr.js`.
- Live bundle inspection shows older analytics hook behavior:
  - direct throw on failed `/api/analytics` fetch,
  - no client-side fallback/normalization path.
- Local source + local build contain newer hardened behavior:
  - API validation (`status` + `content-type`),
  - fallback computation through browser Supabase client,
  - normalized payload shape via `analyticsShape`.
- Conclusion: hosted frontend bundle is stale relative to local source.

## Follow-up Required
- Redeploy latest code to Vercel production so hosted bundle includes analytics resiliency fixes.
- Re-validate Dashboard/Reports on `https://ferma-tolk.youridea.live` after redeploy.

## Production Redeploy + Favicon Rollout (2026-04-19)
- Performed production deployment:
  - `vercel deploy --prod --yes`
  - Deployment URL: `https://ferma-tolk-41k5ojl34-igorkan010-8748s-projects.vercel.app`
  - Aliased to: `https://ferma-tolk.youridea.live`
- Verified hosted HTML now serves current bundle:
  - `/assets/index-BGbiprjs.js`
  - `last-modified: Sun, 19 Apr 2026 18:21:45 GMT`
- Verified deployed bundle contains analytics fallback logic and no legacy throw path:
  - contains `API fetch failed, using client fallback`
  - does not contain legacy `Failed to fetch analytics`

## Favicon/Search Icon Changes (2026-04-19)
- Added generated icon assets in `public/`:
  - `favicon.ico`
  - `favicon-16x16.png`
  - `favicon-32x32.png`
  - `apple-touch-icon.png`
  - `android-chrome-192x192.png`
  - `android-chrome-512x512.png`
  - `site.webmanifest`
- Updated `index.html` head metadata:
  - favicon links (ICO + PNG sizes)
  - Apple touch icon
  - web manifest link
  - theme color
- Live verification (`https://ferma-tolk.youridea.live`) confirms all icon endpoints return `HTTP/2 200` with expected content types.

## Search Indexing Readiness Rollout (2026-04-19)
- Added crawler files:
  - `public/robots.txt`
  - `public/sitemap.xml`
- Updated SEO metadata in `index.html`:
  - `<meta name="description" ...>`
  - `<meta name="robots" content="index, follow">`
  - `<link rel="canonical" href="https://ferma-tolk.youridea.live/">`
- Deployed to production:
  - `vercel deploy --prod --yes`
  - Deployment URL: `https://ferma-tolk-jkeabfodw-igorkan010-8748s-projects.vercel.app`
  - Aliased to `https://ferma-tolk.youridea.live`

## Live Verification (Post-Deploy)
- `GET /robots.txt`:
  - `HTTP/2 200`
  - `content-type: text/plain; charset=utf-8`
  - body includes sitemap pointer.
- `GET /sitemap.xml`:
  - `HTTP/2 200`
  - `content-type: application/xml`
  - body includes canonical homepage URL entry.


<!-- ZERO_BUDGET_PLAN_NOTE:START -->
## Zero-Budget Deployment Note

Use DEPLOYMENT_ZERO_BUDGET.md as the source of truth for cost controls and fallback hosting.
<!-- ZERO_BUDGET_PLAN_NOTE:END -->
