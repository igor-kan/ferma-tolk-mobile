# PLAN

Last updated: 2026-04-19

## Objective
Resolve `42P17` recursion errors for `public.farm_memberships` without weakening existing authorization behavior.

## Constraints
- Must be forward-compatible with existing deployed environments.
- Must keep invite/admin/owner flows functionally equivalent.
- Must preserve RLS as source of truth for browser-facing data access.

## Implementation Plan
1. Add migration `010_fix_farm_memberships_rls_recursion.sql`.
2. Create `private` schema helper functions:
   - `private.is_farm_admin(farm_id, user_id)`
   - `private.is_farm_owner(farm_id, user_id)`
3. Restrict helper function execution to `authenticated`.
4. Drop/recreate only recursive `farm_memberships` policies to call helper functions.
5. Validate migration ordering and repo checks.
6. Run RLS verification SQL tests on a migrated DB.

## Acceptance Criteria
- Authenticated app load no longer fails with `infinite recursion ... farm_memberships`.
- Membership policy behavior remains:
  - users can see own memberships
  - owners/admins can see and manage farm memberships
  - self-leave is still allowed
  - invite acceptance hardening from migration `004` remains intact
- Migration passes repository migration validation script.

## Rollback
- If regression is found, deploy a follow-up migration that redefines only affected policies/functions.
- Do not rewrite or delete prior migration files in shared environments.

## Secondary Objective
Restore Dashboard (`Главная`) and Reports (`Отчеты`) rendering when analytics API is unavailable or non-JSON in local/dev paths.

## Secondary Implementation Plan
1. Normalize analytics payload shape in one place before UI consumption.
2. Keep `/api/analytics` as primary data source.
3. Add client-side Supabase analytics fallback when API fetch fails or response is not JSON.
4. Ensure `cycleAnalytics` is always an array for Reports rendering.
5. Add unit tests for normalization logic and run repository tests.

## Secondary Acceptance Criteria
- Dashboard and Reports render without runtime type errors.
- Local Vite dev works even when `/api/analytics` serves JS module source.
- Existing analytics calculations remain consistent with shared `analytics.js` service functions.

## Tertiary Objective
Align hosted Vercel production bundle with current local analytics-resilience code so Dashboard/Reports behavior matches between `localhost:5173` and `ferma-tolk.youridea.live`.

## Tertiary Implementation Plan
1. Read live `index.html` and record current script asset hash served by Vercel.
2. Build local production bundle and record local script asset hash.
3. Inspect live bundle analytics hook implementation for fallback/normalization presence.
4. If hashes/logic differ, redeploy the latest code to Vercel production.
5. Re-verify hosted Dashboard/Reports behavior after redeploy.

## Tertiary Acceptance Criteria
- Live production `index.html` references the latest bundle hash from current source.
- Hosted bundle includes analytics API fallback + payload normalization logic.
- Dashboard (`Главная`) and Reports (`Отчеты`) no longer show load-error state caused by legacy analytics fetch path.

## Quaternary Objective
Make the production site crawler-ready so search engines can discover and index `ferma-tolk.youridea.live`.

## Quaternary Implementation Plan
1. Add a real `robots.txt` in `public/` to allow crawling and point to sitemap.
2. Add a real `sitemap.xml` in `public/` listing the canonical homepage URL.
3. Add `description`, `robots`, and `canonical` metadata to `index.html`.
4. Redeploy production and validate response content-types for robots/sitemap.

## Quaternary Acceptance Criteria
- `robots.txt` returns `HTTP 200` with `text/plain`.
- `sitemap.xml` returns `HTTP 200` with `application/xml`.
- Homepage head includes crawl/index hints and canonical URL.


<!-- ZERO_BUDGET_PLAN_NOTE:START -->
## Zero-Budget Deployment Note

Use DEPLOYMENT_ZERO_BUDGET.md as the source of truth for cost controls and fallback hosting.
<!-- ZERO_BUDGET_PLAN_NOTE:END -->
