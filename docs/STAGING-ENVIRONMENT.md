# Staging Environment Setup (FT-034)

## 1. Objective
Provide a production-mirror environment for validating schema migrations, RLS policies, and API behavior before they are deployed to the production environment.

## 2. Infrastructure
- **Database (Supabase):** A separate Supabase project named `ferma-tolk-staging`.
  - Must have the same extensions enabled (`pgcrypto`, `pg_stat_statements`).
  - All migrations from `supabase/migrations/` must be applied.
  - Seeding with `supabase/seed.sql` is encouraged for consistent smoke testing.
- **Frontend/API (Vercel):** A Vercel project linked to the `staging` branch.
  - Environment variables must be set manually in Vercel to match the staging Supabase project.

## 3. Environment Variables (Staging)
| Variable | Value Source |
|----------|--------------|
| `VITE_SUPABASE_URL` | Supabase Staging Settings |
| `VITE_SUPABASE_ANON_KEY` | Supabase Staging Settings |
| `SUPABASE_URL` | Supabase Staging Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Staging Settings (Secret) |
| `DEEPGRAM_API_KEY` | Deepgram API Key (Can be shared or separate) |
| `APP_ORIGIN` | `https://ferma-tolk-staging.vercel.app` |

## 4. Release Workflow
1. Features are merged from feature branches to `main`.
2. `main` is periodically merged into `staging`.
3. CI runs all tests and smoke tests against the staging URL.
4. Manual validation by the team on staging.
5. `staging` is merged into `production` (or tagged) for final release.

## 5. Smoke Testing
Before a release is considered "validated" on staging, the `npm run smoke-test` script must pass against the staging URL.
