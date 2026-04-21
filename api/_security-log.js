/**
 * api/_security-log.js — Centralized security event logger
 * ----------------------------------------------------------
 * FT-014
 *
 * Single source of truth for all security-relevant log events emitted by
 * Vercel Edge Functions. All events use a canonical schema so they can be
 * parsed, filtered, and alerted on consistently.
 *
 * CANONICAL SCHEMA
 * ----------------
 * Every event emitted by this module has the shape:
 *
 *   [sec] {
 *     "ts":       ISO-8601 UTC timestamp              string  — always present
 *     "t":        event type identifier               string  — always present
 *     "outcome":  "allowed" | "denied" | "error"     string  — always present
 *     "endpoint": request path, e.g. "/api/speech"   string  — always present
 *     "method":   HTTP method, e.g. "POST"            string  — when available
 *     "ip":       caller IP (hashed in production)    string  — always present
 *     "uid":      Supabase user UUID or "anon"        string  — when available
 *     "status":   HTTP status code returned           number  — on responses
 *     "reason":   machine-readable denial reason      string  — on denials
 *     "ua":       user-agent (first 120 chars)        string  — when available
 *   }
 *
 * WHAT IS DELIBERATELY EXCLUDED
 * ------------------------------
 *   - JWT tokens, API keys, passwords, or any credential material
 *   - Full user-agent strings (truncated to 120 chars)
 *   - Request bodies or response bodies
 *   - Email addresses (user UUID only — de-identifies PII)
 *   - Full IP addresses in production (hashed with a daily rotating salt)
 *
 * EVENT TYPES (t field)
 * ---------------------
 *   AUTH_SUCCESS          — JWT validated, user identified
 *   AUTH_FAILURE          — JWT missing, malformed, or rejected by Supabase
 *   AUTH_SERVICE_ERROR    — Supabase auth endpoint unreachable or returned 5xx
 *   ACCESS_ALLOWED        — Protected endpoint processed successfully
 *   ACCESS_DENIED         — Protected endpoint rejected (non-auth reason)
 *   RATE_LIMIT_IP         — IP-based rate limit exceeded
 *   RATE_LIMIT_USER       — Per-user per-minute limit exceeded
 *   RATE_LIMIT_BURST      — Burst limit exceeded (too many in 3 s)
 *   RATE_LIMIT_DAILY      — Daily quota exceeded
 *   SIZE_REJECTED         — Request payload too large
 *   CORS_REJECTED         — Request from disallowed origin
 *   CONFIG_ERROR          — Missing required environment variable
 *
 * USAGE PATTERN
 * -------------
 *   import { secLog } from './_security-log.js';
 *
 *   secLog(req, {
 *     t:       'AUTH_FAILURE',
 *     outcome: 'denied',
 *     status:  401,
 *     reason:  'INVALID_TOKEN',
 *     uid:     'anon',
 *   });
 *
 * Ticket: FT-014
 */

// ---------------------------------------------------------------------------
// IP pseudonymisation
// ---------------------------------------------------------------------------
// In production we hash the client IP with a daily rotating string to prevent
// raw IP addresses from appearing in logs (privacy), while still allowing
// same-session correlation (same day, same IP → same hash).
//
// The "salt" is the current UTC date string — cheap, no secrets needed, and
// means the hash rotates every day so long-term IP tracking is not possible
// from logs alone.
//
// In non-production environments the raw IP is logged for easier debugging.
const _isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.VITE_APP_ENV === 'production' ||
  process.env.APP_ENV === 'production';

/**
 * Returns a pseudonymised representation of the IP for logging.
 * Production: "ip:<first-8-chars-of-hash>" — correlatable within a day
 * Development: raw IP string
 *
 * @param {string} ip
 * @returns {Promise<string>}
 */
async function pseudonymiseIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (!_isProd) return ip;

  // Daily rotating salt — UTC date string, e.g. "2026-04-05"
  const salt = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${salt}:${ip}`);

  let hashHex;
  try {
    const buf = await crypto.subtle.digest('SHA-256', data);
    hashHex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'hash-unavailable';
  }

  return `ip:${hashHex.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Extract request metadata (safe, no secrets)
// ---------------------------------------------------------------------------
/**
 * @param {Request} req
 * @returns {{ endpoint: string, method: string, ip: string, ua: string }}
 */
export function extractRequestMeta(req) {
  const url = req?.url ? new URL(req.url) : null;
  const endpoint = url?.pathname || 'unknown';
  const method = req?.method || 'unknown';

  // IP extraction (Vercel sets x-forwarded-for; Cloudflare sets cf-connecting-ip)
  const ip =
    req?.headers?.get('cf-connecting-ip') ||
    req?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req?.headers?.get('x-real-ip') ||
    'unknown';

  // Truncate user-agent to avoid storing full fingerprint strings
  const rawUa = req?.headers?.get('user-agent') || '';
  const ua = rawUa.slice(0, 120);

  return { endpoint, method, ip, ua };
}

// ---------------------------------------------------------------------------
// secLog — primary logging function
// ---------------------------------------------------------------------------
/**
 * Emit a structured security log line.
 *
 * @param {Request|null} req      — incoming request (may be null for synthetic events)
 * @param {object}       fields   — event fields (see schema above)
 * @param {'warn'|'error'|'info'} [level='warn']
 */
export async function secLog(req, fields, level = 'warn') {
  const meta = req ? extractRequestMeta(req) : {};
  const ipRaw = fields.ip || meta.ip || 'unknown';
  const ipSafe = await pseudonymiseIp(ipRaw);

  const entry = {
    ts: new Date().toISOString(),
    t: fields.t || 'UNKNOWN',
    outcome: fields.outcome || 'unknown',
    endpoint: fields.endpoint || meta.endpoint || 'unknown',
    method: fields.method || meta.method || undefined,
    ip: ipSafe,
    uid: fields.uid || 'anon',
    status: fields.status || undefined,
    reason: fields.reason || undefined,
    ua: fields.ua || meta.ua || undefined,
  };

  // Remove undefined fields to keep logs compact
  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }

  // Validate no secret material slipped in
  const serialized = JSON.stringify(entry);
  if (
    serialized.includes('eyJ') || // JWT header prefix
    serialized.length > 2000 // suspiciously large — truncate instead of omitting
  ) {
    console.error('[sec] Log entry exceeds safety limit or contains token-like data — suppressed');
    return;
  }

  // eslint-disable-next-line no-console
  console[level in console ? level : 'warn']('[sec]', serialized);
}

// ---------------------------------------------------------------------------
// secLogSync — synchronous variant (IP is NOT pseudonymised)
// Only use in development or for non-production events where async is not available.
// ---------------------------------------------------------------------------
/**
 * @param {Request|null} req
 * @param {object}       fields
 * @param {'warn'|'error'|'info'} [level='warn']
 */
export function secLogSync(req, fields, level = 'warn') {
  const meta = req ? extractRequestMeta(req) : {};

  const entry = {
    ts: new Date().toISOString(),
    t: fields.t || 'UNKNOWN',
    outcome: fields.outcome || 'unknown',
    endpoint: fields.endpoint || meta.endpoint || 'unknown',
    method: fields.method || meta.method || undefined,
    ip: meta.ip || 'unknown',
    uid: fields.uid || 'anon',
    status: fields.status || undefined,
    reason: fields.reason || undefined,
    ua: fields.ua || meta.ua || undefined,
  };

  // Remove undefined fields to keep logs compact
  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }

  const serialized = JSON.stringify(entry);
  if (serialized.includes('eyJ') || serialized.length > 2000) {
    console.error('[sec] Log entry safety check failed — suppressed');
    return;
  }

  // eslint-disable-next-line no-console
  console[level in console ? level : 'warn']('[sec]', serialized);
}
