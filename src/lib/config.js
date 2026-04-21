/**
 * src/lib/config.js — Centralized browser-side environment configuration
 * -----------------------------------------------------------------------
 * FT-013
 *
 * Single source of truth for all VITE_* environment variables used in the
 * browser bundle (src/ directory).
 *
 * Vite replaces `import.meta.env.VITE_*` references at build time.
 * Variables without the VITE_ prefix are NOT available in browser code.
 *
 * Fail-fast behaviour:
 *   - In 'production' mode: throws an Error if required vars are absent.
 *     This causes the ErrorBoundary to display a clear configuration error
 *     screen rather than silently serving a broken experience.
 *   - In 'local' / 'development' / 'staging': logs a console.warn and
 *     continues so UI development can proceed without a live database.
 *
 * Ticket: FT-013
 */

// ---------------------------------------------------------------------------
// Raw reads
// ---------------------------------------------------------------------------
const _url = import.meta.env.VITE_SUPABASE_URL ?? '';
const _anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const _appEnv = import.meta.env.VITE_APP_ENV || 'local';
const _isDev = import.meta.env.DEV ?? false;
const _isProd = import.meta.env.PROD ?? false;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED = [
  { name: 'VITE_SUPABASE_URL', value: _url },
  { name: 'VITE_SUPABASE_ANON_KEY', value: _anonKey },
];

function validateBrowserEnv() {
  const missing = REQUIRED.filter((v) => !v.value).map((v) => v.name);
  if (missing.length === 0) return;

  const message =
    `[config] Missing required environment variable(s): ${missing.join(', ')}.\n` +
    `Copy .env.example to .env.local and fill in your Supabase project credentials.\n` +
    `See docs/SECRETS-MANAGEMENT.md for the full variable reference.`;

  if (_appEnv === 'production' || _isProd) {
    // Hard fail — the ErrorBoundary in main.jsx will catch this throw
    // and display a user-friendly configuration error screen.
    throw new Error(message);
  } else {
    console.warn(message);
  }
}

validateBrowserEnv();

// ---------------------------------------------------------------------------
// Typed exports
// ---------------------------------------------------------------------------

/** Supabase project URL. Safe to expose in the browser (public). */
export const SUPABASE_URL = _url;

/** Supabase anon/public key. Safe to expose in the browser.
 *  Access is gated by Row-Level Security policies, not by this key's secrecy. */
export const SUPABASE_ANON_KEY = _anonKey;

/** Current environment tag: 'local' | 'development' | 'staging' | 'production' */
export const APP_ENV = _appEnv;

/** True when running in Vite development server (HMR). */
export const IS_DEV = _isDev;

/** True when running in a Vite production build. */
export const IS_PROD = _isProd;

/** True if the app is running in production mode. */
export const IS_PRODUCTION = _appEnv === 'production' || _isProd;
