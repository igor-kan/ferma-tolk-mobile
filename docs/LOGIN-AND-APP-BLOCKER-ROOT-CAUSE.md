# Login And App Blocker Root Cause

Last updated: 2026-04-19

## What you saw
- You could authenticate, but the app immediately showed:
  - `Ошибка загрузки данных`
  - `infinite recursion detected in policy for relation "farm_memberships"`
- Result: app data never loaded, so the UI was effectively unusable after login.

## Important clarification
- The primary failure was not password/session authentication itself.
- Login succeeded, but the first authenticated data reads failed due to a database RLS policy error.
- From a user perspective this looks like "cannot log in/use app", because post-login screens depend on those reads.

## Exact code issue
- In `supabase/migrations/002_farms_memberships_preferences.sql`, several RLS policies on `public.farm_memberships` queried `public.farm_memberships` again inside their own policy expressions.
- Problematic policies:
  - `memberships: admins see farm`
  - `memberships: admins can invite`
  - `memberships: admins can manage`
  - `memberships: owners can remove or self-leave`
- This created self-referential policy evaluation and PostgreSQL raised:
  - SQLSTATE `42P17`
  - `infinite recursion detected in policy for relation "farm_memberships"`

## Why this blocked app usage
- The app loads tenant/user context and analytics right after authentication.
- Those reads depend on membership-scoped access and related RLS checks.
- Once policy evaluation hit recursive `farm_memberships` checks, queries failed and app state stayed in error mode.

## Fix that was implemented
- Added forward migration:
  - `supabase/migrations/010_fix_farm_memberships_rls_recursion.sql`
- Replaced recursive inline checks with `SECURITY DEFINER` helpers in schema `private`:
  - `private.is_farm_admin(farm_id, user_id)`
  - `private.is_farm_owner(farm_id, user_id)`
- Recreated only the recursive policies to call those helpers.
- Added regression test:
  - `supabase/tests/rls_verification.sql` test `T-10`
  - Confirms `farm_memberships` SELECT no longer throws `42P17`.

## Issues encountered during investigation/fix
- Existing migration history contained the recursive policy pattern, so the fix had to be forward-only (new migration) instead of rewriting old migrations.
- Local SQL RLS suite could not be executed end-to-end in this session because `SUPABASE_DB_URL` was not set.
- Repository lint had pre-existing unrelated errors in frontend files (`Auth.jsx`, `AddEntry.jsx`), which are not caused by this database fix.
- There were many unrelated uncommitted workspace changes, so scope was kept strictly to this incident files to avoid accidental interference.

## Current status
- Root cause identified and patched in migration `010`.
- Migration integrity checks and Node tests passed.
- Remaining deployment steps:
  1. Apply migration to target database (`supabase db push`).
  2. Run RLS SQL verification against that database.
  3. Confirm post-login app data loads without the recursion error.
