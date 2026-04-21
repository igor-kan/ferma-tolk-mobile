# Deployment Pipeline & Rollback Procedure (FT-035)

## 1. Automated Deployment Pipeline
The application uses a two-stage deployment pipeline (Staging and Production) triggered by GitHub Actions.

### Pipeline Stages
1.  **Validation (CI):** Triggered on all Pull Requests to `main` and `staging`.
    - Validates environment variables.
    - Validates migration sequence and headers.
    - Runs linting and formatting checks.
    - Runs unit/integration tests (128+ tests).
    - Runs E2E tests (Playwright).
2.  **Staging Deploy:** Triggered on push to the `staging` branch.
    - Deploys frontend and Edge Functions to Vercel Staging.
    - Automated Smoke Test runs against the staging URL.
3.  **Production Deploy:** Triggered on push to the `main` branch.
    - Deploys to Vercel Production.
    - Manual confirmation of database migration application (see below).

## 2. Database Migration Control
Database migrations are strictly sequential (`NNN_name.sql`).
- **Development:** Developers run migrations locally using `supabase db reset`.
- **Staging/Production:** Migrations are applied via the Supabase Dashboard or `supabase db push`.
- **Order:** The `validate:migrations` script in CI ensures that no gaps or duplicate numbers exist, guaranteeing a deterministic application order.

## 3. Rollback Procedure

### Frontend & API (Vercel)
In the event of a breaking UI or API change:
1.  Navigate to the Vercel Dashboard -> Deployments.
2.  Identify the last known stable deployment.
3.  Click "Instant Rollback". Vercel will re-alias the production domain to the previous build in seconds.

### Database (Supabase)
Database rollbacks are more complex and should be handled with care:
1.  **Small Schema Changes:** If a migration added a column/index that is causing issues, manually revert it via the Supabase SQL Editor (e.g., `DROP INDEX idx_name`).
2.  **Destructive Changes:** If data was corrupted or a table was dropped:
    - Use **Point-in-Time Recovery (PITR)** in the Supabase Dashboard.
    - Restore the database to a timestamp immediately preceding the deployment.
3.  **Prevention:** Never use destructive `DROP` or `RENAME` commands without a corresponding data backup and verified rollback script.

## 4. Release Traceability
- Every production deployment is tagged in Git (e.g., `v1.2.3`).
- The `package.json` version is incremented for each major release.
- Deployment logs in Vercel and GitHub Actions provide a permanent audit trail of who deployed what and when.
