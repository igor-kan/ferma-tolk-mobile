# Database Setup Guide

**Project:** Ferma.Tolk  
**Platform:** Supabase (managed PostgreSQL 15)  
**Ticket:** FT-004

This document covers everything needed to provision, connect, and verify the database for each environment.

---

## Environments

| Environment   | Purpose                      | Supabase Project              |
| ------------- | ---------------------------- | ----------------------------- |
| `local`       | Individual developer machine | Supabase local stack (Docker) |
| `development` | Shared dev cloud instance    | Separate Supabase project     |
| `staging`     | Pre-production verification  | Separate Supabase project     |
| `production`  | Live users                   | Separate Supabase project     |

**Rule:** Every environment must be a separate Supabase project. Never share database credentials between environments. Never point staging or local at the production project.

---

## Prerequisites

```bash
# Supabase CLI
npm install -g supabase

# Verify
supabase --version   # should be >= 1.200.0

# Docker (required for local stack)
docker --version
```

---

## 1. Local Development

### 1a. Start the local Supabase stack

```bash
# From the project root
supabase start
```

This starts PostgreSQL, PostgREST, GoTrue (auth), Studio, and Inbucket locally via Docker. The first run downloads images (~600 MB).

Expected output:

```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJ...
service_role key: eyJ...
```

### 1b. Apply migrations and seed data

```bash
supabase db reset
```

This drops and recreates the local database, applies all files in `supabase/migrations/` in order, then runs `supabase/seed.sql`.

### 1c. Configure local environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the values printed by `supabase start`:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
VITE_APP_ENV=local
```

### 1d. Start the app

```bash
npm run dev
```

Open the browser console — you should see `[supabase] Connected successfully.`

### 1e. Local Studio

Open `http://localhost:54323` to browse tables, run SQL, and inspect auth users.

Dev credentials (seeded by `supabase/seed.sql`):

- Email: `dev@ferma.tolk`
- Password: `devpassword123`

---

## 2. Hosted Supabase (Development / Staging / Production)

### 2a. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Name: `ferma-tolk-development` (or `-staging`, `-production`)
4. Region: choose closest to your users (e.g. `eu-central-1` for Central Asia)
5. Password: generate a strong password and store it in your password manager
6. Plan: Free tier for development/staging; Pro (or higher) for production

### 2b. Link the CLI to your project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

The project ref is the subdomain in your project URL:  
`https://YOUR_PROJECT_REF.supabase.co`

### 2c. Apply migrations to the hosted project

```bash
# Push all migrations in supabase/migrations/ to the linked project
supabase db push
```

Verify in the Supabase Dashboard → Table Editor that all tables are created.

### 2d. Enable backups (production)

In the Supabase Dashboard for your **production** project:

1. Go to **Settings → Database**
2. Under **Backups**, confirm **Daily backups** are enabled (Pro plan and above)
3. Note the backup retention period (7 days on Pro)
4. Optionally enable **Point-in-Time Recovery (PITR)** for fine-grained restore

For staging, daily backups are sufficient. For production, consider PITR.

### 2e. Configure environment variables in Vercel

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables**
2. Add each variable from `.env.example` with the correct value for each environment scope (Production / Preview / Development)

**Variables to set:**

| Variable                    | Scope                                                         | Server-side?        | Value source                                                              |
| --------------------------- | ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | All                                                           | No (browser bundle) | Supabase Dashboard → Settings → API → Project URL                         |
| `VITE_SUPABASE_ANON_KEY`    | All                                                           | No (browser bundle) | Supabase Dashboard → Settings → API → anon key                            |
| `SUPABASE_URL`              | All                                                           | **Yes**             | Same value as `VITE_SUPABASE_URL` — but set separately for Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | All                                                           | **Yes**             | Supabase Dashboard → Settings → API → service_role key                    |
| `SUPABASE_DB_URL`           | All                                                           | **Yes**             | Supabase Dashboard → Settings → Database → URI                            |
| `DEEPGRAM_API_KEY`          | All                                                           | **Yes**             | Deepgram console                                                          |
| `APP_ORIGIN`                | All                                                           | **Yes**             | Your production domain, e.g. `https://ferma.tolk.app`                     |
| `VITE_APP_ENV`              | Production=`production`, Preview=`staging`, Dev=`development` | No                  | Manual                                                                    |

> **Why both `VITE_SUPABASE_URL` and `SUPABASE_URL`?**
> Vite injects `VITE_*` variables into the browser bundle at build time. Vercel Edge Functions
> (the `api/` directory) run server-side and use `process.env` — they cannot access Vite's
> build-time substitutions. You must set `SUPABASE_URL` as a plain Vercel env var for Edge
> Functions, separately from `VITE_SUPABASE_URL`. Both should point to the same URL value.

**Important:** Use separate values for each environment scope. The production Supabase project credentials must only be set on the Production scope.

---

## 3. Connectivity Verification

### From the browser

After setting env vars, open the browser dev console after logging in. The Supabase client probe will log:

```
[supabase] Connected successfully.
```

If you see a warning instead, check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match the correct project.

### From Vercel Edge Functions (API routes)

Deploy a test request to `/api/speech` — it will fail with a Deepgram error if credentials are missing, or return a transcription result if fully configured. The admin client in `api/_supabase-admin.js` will throw at import time if `SUPABASE_SERVICE_ROLE_KEY` is absent.

### Direct database connection (migrations / admin)

```bash
# Test the connection string
psql "$SUPABASE_DB_URL" -c "SELECT current_database(), now();"
```

Expected output:

```
 current_database |              now
------------------+-------------------------------
 postgres         | 2026-04-05 12:00:00.000000+00
```

### Row-Level Security verification

```bash
# Connect as the postgres superuser and verify RLS is enabled
psql "$SUPABASE_DB_URL" -c "
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
"
```

Expected output: `rowsecurity = t` for every table.

---

## 4. Backup and Restore

### Automated backups (Supabase managed)

Supabase Pro and above: daily logical backups with 7-day retention, accessible from Dashboard → Settings → Backups.

To restore: Dashboard → Settings → Backups → select snapshot → Restore.

### Manual backup

```bash
pg_dump "$SUPABASE_DB_URL" \
  --no-acl \
  --no-owner \
  --format=custom \
  --file="ferma_tolk_backup_$(date +%Y%m%d_%H%M%S).pgdump"
```

### Manual restore

```bash
pg_restore \
  --dbname="$SUPABASE_DB_URL" \
  --no-acl \
  --no-owner \
  ferma_tolk_backup_YYYYMMDD_HHMMSS.pgdump
```

### Restore verification test

After any restore, run:

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT
    (SELECT count(*) FROM public.users)         AS users,
    (SELECT count(*) FROM public.transactions)  AS transactions,
    (SELECT count(*) FROM public.projects)      AS projects;
"
```

Compare counts against pre-backup values.

---

## 5. Adding New Migrations

All schema changes must go through migration files — never edit the database directly in production.

```bash
# Create a new numbered migration
supabase migration new <descriptive_name>
# e.g.: supabase migration new add_transaction_tags
```

This creates `supabase/migrations/002_add_transaction_tags.sql` (auto-numbered). Edit the file, then:

```bash
# Apply locally
supabase db reset

# Push to hosted project when ready
supabase db push
```

---

## 6. Security Notes

- The `anon` role has no table access unless an RLS policy explicitly grants it. All policies in migration `001` use `auth.uid()` — unauthenticated requests return empty results, not errors.
- The `service_role` key bypasses RLS entirely. Treat it like a root password: rotate it if compromised, never log it, never expose it in the browser.
- `pg_stat_statements` extension is enabled for query performance monitoring. Review slow queries regularly.
- SSL is required on all hosted connections (`?sslmode=require` in the connection string).

---

_Last updated: 2026-04-05 | Ticket: FT-004_
