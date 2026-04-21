/**
 * api/_config.js — Centralized server-side environment configuration
 * -------------------------------------------------------------------
 * FT-013
 *
 * Single source of truth for all environment variables used by Vercel
 * Edge Functions (the api/ directory).
 *
 * IMPORTANT — Vite vs Edge Function env vars
 * -------------------------------------------
 * Vite replaces `import.meta.env.VITE_*` at *build time* for the browser
 * bundle. Edge Functions run at *request time* in a Node/V8 context and
 * use `process.env` — they NEVER receive Vite build-time substitutions.
 *
 * Rule: any variable used in api/ must be set as a plain Vercel environment
 * variable (no VITE_ prefix required, though the same URL value is needed
 * for both the browser VITE_SUPABASE_URL and the server SUPABASE_URL).
 *
 * Variable groups:
 *
 *   REQUIRED_ALWAYS  — must be present in every environment; missing = 500
 *   REQUIRED_SPEECH  — must be present for the speech endpoint specifically
 *   OPTIONAL         — have safe defaults; absence is logged as a warning
 *
 * Ticket: FT-013
 */

// ---------------------------------------------------------------------------
// Raw reads
// ---------------------------------------------------------------------------

const ENV = {
  // Supabase — server-side (no VITE_ prefix)
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, // local-dev fallback only
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Deepgram — speech endpoint only
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,

  // CORS — allowed origin for the speech endpoint
  APP_ORIGIN: process.env.APP_ORIGIN || '',

  // Rate limiting tunables (optional — defaults are safe)
  RATE_IP_MAX: parseInt(process.env.RATE_IP_MAX || '30', 10),
  RATE_USER_MAX: parseInt(process.env.RATE_USER_MAX || '10', 10),
  RATE_BURST_MAX: parseInt(process.env.RATE_BURST_MAX || '5', 10),
  RATE_DAILY_MAX: parseInt(process.env.RATE_DAILY_MAX || '200', 10),
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that all required environment variables are present.
 * Returns { ok: true } or { ok: false, missing: string[], message: string }.
 *
 * @param {'auth'|'speech'|'all'} [scope='all'] — which group to validate
 */
export function validateServerEnv(scope = 'all') {
  const missing = [];

  if (scope === 'auth' || scope === 'all') {
    if (!ENV.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!ENV.SUPABASE_SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (scope === 'speech' || scope === 'all') {
    if (!ENV.DEEPGRAM_API_KEY) missing.push('DEEPGRAM_API_KEY');
  }

  if (missing.length === 0) return { ok: true };

  const message =
    `[config] Missing required server-side environment variable(s): ${missing.join(', ')}.\n` +
    `Set them in Vercel → Settings → Environment Variables (server-side, no VITE_ prefix).\n` +
    `See docs/SECRETS-MANAGEMENT.md for the full variable reference.`;

  console.error(
    '[config]',
    JSON.stringify({
      t: 'MISSING_ENV_VARS',
      missing,
      scope,
      hint: 'See docs/SECRETS-MANAGEMENT.md',
    })
  );

  return { ok: false, missing, message };
}

/**
 * Asserts required vars are present and returns a 500 Response if not.
 * Designed for use at the top of an Edge Function handler.
 *
 * @param {'auth'|'speech'|'all'} scope
 * @returns {Response|null} — null if OK, Response(500) if misconfigured
 */
export function assertServerEnv(scope = 'all') {
  const result = validateServerEnv(scope);
  if (result.ok) return null;

  return new Response(
    JSON.stringify({ error: 'Service misconfigured. Contact the administrator.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Exports — typed accessors
// ---------------------------------------------------------------------------

/** Supabase project URL (server-side). Undefined if not set. */
export const SUPABASE_URL = ENV.SUPABASE_URL;

/** Supabase service_role key. Bypasses RLS. Server-side only. Undefined if not set. */
export const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE;

/** Deepgram API key. Server-side only. Undefined if not set. */
export const DEEPGRAM_API_KEY = ENV.DEEPGRAM_API_KEY;

/** Allowed CORS origin for the speech endpoint. Empty string = allow all *.vercel.app. */
export const APP_ORIGIN = ENV.APP_ORIGIN;

/** Rate limit: max requests per IP per minute. Default: 30. */
export const RATE_IP_MAX = ENV.RATE_IP_MAX;

/** Rate limit: max requests per authenticated user per minute. Default: 10. */
export const RATE_USER_MAX = ENV.RATE_USER_MAX;

/** Burst limit: max requests per user per 3 seconds. Default: 5. */
export const RATE_BURST_MAX = ENV.RATE_BURST_MAX;

/** Daily quota: max requests per user per UTC calendar day. Default: 200. */
export const RATE_DAILY_MAX = ENV.RATE_DAILY_MAX;
