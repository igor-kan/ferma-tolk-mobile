/**
 * api/_rate-limiter.js — Multi-layer abuse protection for Edge Functions
 * -----------------------------------------------------------------------
 * FT-010 / FT-013 / FT-014
 *
 * Three independent limiters applied in order for each request:
 *
 *   1. IP limiter    — blocks unauthenticated or credential-stuffing bursts
 *                      before auth overhead is paid. Keyed on x-forwarded-for.
 *                      Limit: 30 req/min per IP.
 *
 *   2. User limiter  — per-authenticated-user sliding window.
 *                      Limit: 10 req/min per user.
 *
 *   3. Burst limiter — detects rapid consecutive calls within a short window,
 *                      regardless of the per-minute total. A user who fires
 *                      5 requests within 3 seconds is considered abusive.
 *                      Limit: 5 req per 3 s per user.
 *
 *   4. Daily quota   — caps total calls per user per calendar day (UTC).
 *                      Prevents a user from consuming the entire Deepgram
 *                      budget in one session. Limit: 200 req/day per user.
 *
 * All limiters are in-memory (per Edge instance). At current scale this is
 * sufficient. For true global limits, replace with Vercel KV or Upstash Redis
 * and call checkAll() with await on each request.
 *
 * LOGGING
 * -------
 * Every rejected request emits a structured JSON log line to console.warn.
 * These appear in Vercel's Function Logs and can be forwarded to Datadog,
 * Sentry, or any log aggregator. Format:
 *
 *   [abuse] {"t":"RATE_LIMIT_USER","uid":"...","ip":"...","count":11,"limit":10}
 *
 * Log types:
 *   RATE_LIMIT_IP      — IP exceeded per-minute limit
 *   RATE_LIMIT_USER    — user exceeded per-minute limit
 *   RATE_LIMIT_BURST   — user triggered burst protection
 *   RATE_LIMIT_DAILY   — user exceeded daily quota
 *   SIZE_REJECTED      — payload over size cap (logged from speech.js)
 */

// ---------------------------------------------------------------------------
// Limits — sourced from _config.js (FT-013: single source of truth)
// ---------------------------------------------------------------------------
import { RATE_IP_MAX, RATE_USER_MAX, RATE_BURST_MAX, RATE_DAILY_MAX } from './_config.js';
import { secLogSync } from './_security-log.js';

const IP_WINDOW_MS = 60_000;
const IP_MAX = RATE_IP_MAX;

const USER_WINDOW_MS = 60_000;
const USER_MAX = RATE_USER_MAX;

const BURST_WINDOW_MS = 3_000;
const BURST_MAX = RATE_BURST_MAX;

const DAILY_MAX = RATE_DAILY_MAX;

// ---------------------------------------------------------------------------
// Store shapes
// ---------------------------------------------------------------------------
/** @type {Map<string, { count: number, windowStart: number }>} */
const ipStore = new Map();
/** @type {Map<string, { count: number, windowStart: number }>} */
const userStore = new Map();
/** @type {Map<string, { count: number, windowStart: number }>} */
const burstStore = new Map();
/** @type {Map<string, { count: number, date: string }>} */
const dailyStore = new Map();

// ---------------------------------------------------------------------------
// Internal: sliding fixed-window counter
// ---------------------------------------------------------------------------
/**
 * Increment a counter in a Map store using a fixed sliding window.
 * Returns { allowed, count, retryAfterMs }.
 *
 * @param {Map} store
 * @param {string} key
 * @param {number} windowMs
 * @param {number} max
 */
function checkWindow(store, key, windowMs, max) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, count: 1, retryAfterMs: 0 };
  }

  entry.count++;

  if (entry.count > max) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, count: entry.count, retryAfterMs };
  }

  return { allowed: true, count: entry.count, retryAfterMs: 0 };
}

// ---------------------------------------------------------------------------
// Internal: daily quota counter
// ---------------------------------------------------------------------------
function checkDaily(userId) {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" UTC
  const entry = dailyStore.get(userId);

  if (!entry || entry.date !== today) {
    dailyStore.set(userId, { count: 1, date: today });
    return { allowed: true, count: 1 };
  }

  entry.count++;
  return { allowed: entry.count <= DAILY_MAX, count: entry.count };
}

// ---------------------------------------------------------------------------
// Internal: structured log helper (FT-014: now delegates to _security-log.js)
// ---------------------------------------------------------------------------
// checkAll() receives a Request when called from speech.js; we also accept
// a plain { endpoint, ip, ua } meta object for callers that don't have the
// full Request.
function logAbuse(type, rateFields, req) {
  secLogSync(req || null, {
    t: type,
    outcome: 'denied',
    status: 429,
    reason: type,
    uid: rateFields.uid || 'anon',
    ip: rateFields.ip || 'unknown',
    endpoint: rateFields.endpoint || (req ? undefined : 'unknown'),
    // count/limit are extra context; pass them as separate fields
    count: rateFields.count,
    limit: rateFields.limit,
  });
}

// ---------------------------------------------------------------------------
// Internal: store pruning (runs periodically to keep memory bounded)
// ---------------------------------------------------------------------------
let pruneCounter = 0;
function maybePrune() {
  if (++pruneCounter < 200) return;
  pruneCounter = 0;

  const nowMs = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (const [k, v] of ipStore.entries()) {
    if (nowMs - v.windowStart >= IP_WINDOW_MS) ipStore.delete(k);
  }
  for (const [k, v] of userStore.entries()) {
    if (nowMs - v.windowStart >= USER_WINDOW_MS) userStore.delete(k);
  }
  for (const [k, v] of burstStore.entries()) {
    if (nowMs - v.windowStart >= BURST_WINDOW_MS) burstStore.delete(k);
  }
  for (const [k, v] of dailyStore.entries()) {
    if (v.date !== today) dailyStore.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Public: extract caller IP from Vercel/Cloudflare headers
// ---------------------------------------------------------------------------
/**
 * Returns the best-effort client IP string, or 'unknown'.
 * Vercel sets x-forwarded-for; Cloudflare sets cf-connecting-ip.
 *
 * @param {Request} req
 * @returns {string}
 */
export function getClientIp(req) {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public: checkAll
// ---------------------------------------------------------------------------
/**
 * Run all rate-limit checks for one request.
 *
 * @param {Object}      opts
 * @param {string}      opts.ip      — caller IP (from getClientIp)
 * @param {string|null} opts.userId  — authenticated user UUID, or null
 * @param {Request}    [opts.req]    — original request for structured logging (FT-014)
 * @returns {{
 *   allowed: boolean,
 *   reason?: string,
 *   retryAfterSec?: number,
 *   headers?: Record<string, string>
 * }}
 */
export function checkAll({ ip, userId, req }) {
  maybePrune();

  // 1. IP-based limit (runs even before userId is known)
  const ipResult = checkWindow(ipStore, ip, IP_WINDOW_MS, IP_MAX);
  if (!ipResult.allowed) {
    const retrySec = Math.ceil(ipResult.retryAfterMs / 1000);
    logAbuse(
      'RATE_LIMIT_IP',
      { ip, uid: userId || null, count: ipResult.count, limit: IP_MAX },
      req
    );
    return {
      allowed: false,
      reason: 'ip_rate_limit',
      retryAfterSec: retrySec,
      headers: {
        'Retry-After': String(retrySec),
        'X-RateLimit-Limit': String(IP_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + ipResult.retryAfterMs) / 1000)),
      },
    };
  }

  // For the remaining checks we need a userId
  if (!userId) {
    return { allowed: false, reason: 'missing_user_id', retryAfterSec: 0, headers: {} };
  }

  // 2. Per-user per-minute window
  const userResult = checkWindow(userStore, userId, USER_WINDOW_MS, USER_MAX);
  if (!userResult.allowed) {
    const retrySec = Math.ceil(userResult.retryAfterMs / 1000);
    logAbuse('RATE_LIMIT_USER', { uid: userId, ip, count: userResult.count, limit: USER_MAX }, req);
    return {
      allowed: false,
      reason: 'user_rate_limit',
      retryAfterSec: retrySec,
      headers: {
        'Retry-After': String(retrySec),
        'X-RateLimit-Limit': String(USER_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + userResult.retryAfterMs) / 1000)),
      },
    };
  }

  // 3. Burst detection
  const burstResult = checkWindow(burstStore, userId, BURST_WINDOW_MS, BURST_MAX);
  if (!burstResult.allowed) {
    const retrySec = Math.ceil(burstResult.retryAfterMs / 1000) || 3;
    logAbuse(
      'RATE_LIMIT_BURST',
      { uid: userId, ip, count: burstResult.count, limit: BURST_MAX },
      req
    );
    return {
      allowed: false,
      reason: 'burst_limit',
      retryAfterSec: retrySec,
      headers: {
        'Retry-After': String(retrySec),
        'X-RateLimit-Limit': String(BURST_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + burstResult.retryAfterMs) / 1000)),
      },
    };
  }

  // 4. Daily quota
  const dailyResult = checkDaily(userId);
  if (!dailyResult.allowed) {
    const now = new Date();
    const midnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const retrySec = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
    logAbuse(
      'RATE_LIMIT_DAILY',
      { uid: userId, ip, count: dailyResult.count, limit: DAILY_MAX },
      req
    );
    return {
      allowed: false,
      reason: 'daily_quota',
      retryAfterSec: retrySec,
      headers: {
        'Retry-After': String(retrySec),
        'X-RateLimit-Limit': String(DAILY_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(midnight.getTime() / 1000)),
      },
    };
  }

  // All checks passed — return remaining quotas for informational headers
  const userRemaining = Math.max(0, USER_MAX - userResult.count);
  const dailyRemaining = Math.max(0, DAILY_MAX - dailyResult.count);

  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': String(USER_MAX),
      'X-RateLimit-Remaining': String(Math.min(userRemaining, dailyRemaining)),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + USER_WINDOW_MS) / 1000)),
    },
  };
}

// ---------------------------------------------------------------------------
// Public: human-readable rejection messages (i18n-ready)
// ---------------------------------------------------------------------------
export const REJECTION_MESSAGES = {
  ip_rate_limit: 'Too many requests from your network. Please wait.',
  user_rate_limit: 'Too many requests. Please wait before transcribing again.',
  burst_limit: 'Requests too fast. Please slow down.',
  daily_quota: 'Daily transcription limit reached. Resets at midnight UTC.',
  missing_user_id: 'Authentication required.',
};
