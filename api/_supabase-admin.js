/**
 * Supabase admin client — SERVER-SIDE ONLY
 * ----------------------------------------
 * FT-004 / FT-013
 *
 * Uses the service_role key, which bypasses Row-Level Security.
 * This file MUST only be imported from api/ (Vercel Edge Functions).
 * NEVER import this from src/ — the service_role key must never reach the browser.
 *
 * FT-013: Uses SUPABASE_URL (server-side plain env var), NOT VITE_SUPABASE_URL.
 * Edge Functions use process.env at request time; they cannot read Vite
 * build-time substitutions.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, assertServerEnv } from './_config.js';

// Fail fast at module load time if required vars are missing
const configError = assertServerEnv('auth');
if (configError) {
  // We can't return a Response from module scope, so we throw instead.
  // This will cause a 500 at the Edge Function level with a clear message.
  throw new Error(
    '[supabase-admin] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set ' +
      'as Vercel environment variables (server-side, no VITE_ prefix). ' +
      'See docs/SECRETS-MANAGEMENT.md.'
  );
}

/**
 * Admin client: bypasses RLS. Use only for:
 * - Server-side auth operations that need to look up any user
 * - Background jobs / data migrations
 * - Anything that must not be gated by the calling user's session
 *
 * For normal user-context operations from API routes, create a per-request
 * client with the user's JWT instead (pass Authorization header through).
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
