/**
 * api/_auth-session.js — Server-side JWT validation helper (Vercel Edge)
 * -----------------------------------------------------------------------
 * FT-006 / FT-009 / FT-013 / FT-014
 *
 * FT-014: All auth outcomes (success + every failure path) are now logged
 * as structured [sec] events via _security-log.js.
 * JWT tokens and credential material are never included in log output.
 */

import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './_config.js';
import { secLog, extractRequestMeta } from './_security-log.js';

export const config = { runtime: 'edge' };

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
/**
 * Validates the Bearer JWT from the Authorization header against Supabase.
 *
 * Returns:
 *   { user: { id, email, role }, error: null, response: null }  — authenticated
 *   { user: null, error: string, response: Response }           — rejected
 *
 * All outcomes are logged as [sec] events.
 *
 * @param {Request} req
 * @returns {Promise<{ user, error, response }>}
 */
export async function requireAuth(req) {
  const _meta = extractRequestMeta(req);

  // Server configuration guard
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    await secLog(
      req,
      {
        t: 'CONFIG_ERROR',
        outcome: 'error',
        status: 500,
        reason: 'MISSING_ENV_VARS',
        uid: 'anon',
      },
      'error'
    );
    return {
      user: null,
      error: 'Server misconfigured',
      response: json({ error: 'Internal server error' }, 500),
    };
  }

  // Extract Bearer token
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    await secLog(req, {
      t: 'AUTH_FAILURE',
      outcome: 'denied',
      status: 401,
      reason: 'MISSING_TOKEN',
      uid: 'anon',
    });
    return {
      user: null,
      error: 'Missing Authorization header',
      response: json({ error: 'Unauthorized' }, 401),
    };
  }

  // Basic token format sanity check — 3 dot-separated base64url parts
  if (token.split('.').length !== 3) {
    await secLog(req, {
      t: 'AUTH_FAILURE',
      outcome: 'denied',
      status: 401,
      reason: 'MALFORMED_TOKEN',
      uid: 'anon',
    });
    return {
      user: null,
      error: 'Malformed token',
      response: json({ error: 'Unauthorized' }, 401),
    };
  }

  // Validate JWT by calling Supabase auth server
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  } catch (_err) {
    await secLog(
      req,
      {
        t: 'AUTH_SERVICE_ERROR',
        outcome: 'error',
        status: 503,
        reason: 'SUPABASE_UNREACHABLE',
        uid: 'anon',
      },
      'error'
    );
    return {
      user: null,
      error: 'Auth service unavailable',
      response: json({ error: 'Service unavailable' }, 503),
    };
  }

  if (!res.ok) {
    await secLog(req, {
      t: 'AUTH_FAILURE',
      outcome: 'denied',
      status: 401,
      reason: 'INVALID_TOKEN',
      uid: 'anon',
    });
    return {
      user: null,
      error: 'Invalid or expired token',
      response: json({ error: 'Unauthorized' }, 401),
    };
  }

  let userData;
  try {
    userData = await res.json();
  } catch {
    await secLog(
      req,
      {
        t: 'AUTH_SERVICE_ERROR',
        outcome: 'error',
        status: 500,
        reason: 'MALFORMED_AUTH_RESPONSE',
        uid: 'anon',
      },
      'error'
    );
    return {
      user: null,
      error: 'Malformed auth response',
      response: json({ error: 'Internal server error' }, 500),
    };
  }

  if (!userData?.id) {
    await secLog(req, {
      t: 'AUTH_FAILURE',
      outcome: 'denied',
      status: 401,
      reason: 'MISSING_USER_ID',
      uid: 'anon',
    });
    return {
      user: null,
      error: 'Missing user ID in auth response',
      response: json({ error: 'Unauthorized' }, 401),
    };
  }

  // Success — log with user UUID (no email in logs)
  await secLog(
    req,
    {
      t: 'AUTH_SUCCESS',
      outcome: 'allowed',
      status: 200,
      uid: userData.id,
    },
    'info'
  );

  return {
    user: {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    error: null,
    response: null,
  };
}

// ---------------------------------------------------------------------------
// Default handler — GET /api/auth-session
// ---------------------------------------------------------------------------
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const { user, error, response } = await requireAuth(req);
  if (error) return response;

  return json({ user }, 200);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
