/**
 * Supabase client singleton
 * -------------------------
 * FT-004 / FT-013
 *
 * This module creates and exports the single shared Supabase client used
 * throughout the application.
 *
 * FT-013: Environment variables now sourced from src/lib/config.js
 * (single source of truth for all browser-side env vars).
 * Validation and fail-fast behaviour live in config.js — this module
 * only instantiates the client.
 *
 * USAGE
 *   import { supabase } from './lib/supabase';
 *   const { data, error } = await supabase.from('transactions').select('*');
 *
 * The service_role key (SUPABASE_SERVICE_ROLE_KEY) is used ONLY in server-side
 * code (api/_supabase-admin.js) and MUST NOT be imported here.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_DEV } from '../../lib/config.js';

// Note: validation already ran in config.js (throws in production if vars absent)

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------
const clientOptions = {
  auth: {
    /**
     * Persist the Supabase auth session in localStorage under the key
     * 'sb-{projectRef}-auth-token'. This is a signed JWT — not a plaintext
     * credential — and is safe for localStorage.
     * See: https://supabase.com/docs/guides/auth/sessions
     */
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    /**
     * Storage key prefix. Keeping this unique per project prevents session
     * collisions when running multiple Supabase projects on the same domain
     * (e.g. local dev vs staging preview).
     */
    storageKey: 'ferma-tolk-auth',
  },
  global: {
    headers: {
      'x-application-name': 'ferma-tolk',
    },
  },
  // Realtime is not used yet; disable to reduce bundle size.
  realtime: {
    params: {
      eventsPerSecond: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * The shared Supabase browser client.
 *
 * - Uses the anon key — all access is gated by RLS policies.
 * - auth.uid() in RLS policies resolves to the currently signed-in user's UUID.
 * - For server-side operations that bypass RLS, create a separate admin client
 *   in the api/ directory using SUPABASE_SERVICE_ROLE_KEY (never import this
 *   module from server-only code that needs elevated access).
 */
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  clientOptions
);

// ---------------------------------------------------------------------------
// Connectivity probe (non-blocking, development only)
// ---------------------------------------------------------------------------
if (IS_DEV && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.warn(
          '[supabase] Connectivity probe failed — database may not be reachable.\n' +
            'Run `supabase start` for local dev or check your project URL.\n' +
            `Error: ${error.message}`
        );
      } else {
        // eslint-disable-next-line no-console
        console.info('[supabase] Connected successfully.');
      }
    });
}
