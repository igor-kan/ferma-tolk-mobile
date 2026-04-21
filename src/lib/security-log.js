/**
 * src/lib/security-log.js — Client-side security event logger
 * -------------------------------------------------------------
 * FT-014
 *
 * Emits structured [auth] log lines for authentication events that happen
 * in the browser (sign-in failures, sign-up errors, session expiry).
 *
 * SCHEMA (mirrors server-side _security-log.js)
 * ----------------------------------------------
 *   [auth] {
 *     "ts":      ISO-8601 UTC timestamp    — always present
 *     "t":       event type                — always present
 *     "outcome": "allowed" | "denied" | "error"
 *     "uid":     Supabase user UUID or "anon"
 *     "reason":  machine-readable reason   — on failures
 *   }
 *
 * What is deliberately EXCLUDED
 * -------------------------------
 *   - Passwords, tokens, raw credential material of any kind
 *   - Email addresses (uid only after authentication, 'anon' before)
 *   - Response bodies from Supabase
 *
 * EVENT TYPES
 * -----------
 *   SIGN_IN_SUCCESS      — user signed in successfully
 *   SIGN_IN_FAILURE      — sign-in rejected (wrong password, not found, etc.)
 *   SIGN_UP_SUCCESS      — new account created
 *   SIGN_UP_FAILURE      — registration rejected (duplicate email, etc.)
 *   SIGN_OUT             — user signed out
 *   SESSION_EXPIRED      — onAuthStateChange fired SIGNED_OUT unexpectedly
 *   PASSWORD_RESET_SENT  — reset email sent
 *   PASSWORD_RESET_ERROR — reset email failed
 *   PASSWORD_UPDATED     — password changed successfully
 *   PASSWORD_UPDATE_ERROR— password change failed
 *
 * Ticket: FT-014
 */

// ---------------------------------------------------------------------------
// Core log emitter
// ---------------------------------------------------------------------------
/**
 * @param {string} type   — event type (see EVENT TYPES above)
 * @param {string} outcome — 'allowed' | 'denied' | 'error'
 * @param {object} [extra] — optional safe extra fields
 */
export function logAuthEvent(type, outcome, extra = {}) {
  // Safety check: never log credential-like strings
  const stringified = JSON.stringify(extra);
  if (
    stringified.includes('eyJ') || // JWT
    stringified.includes('password') || // plain password field
    stringified.includes('secret') || // secret answer etc.
    stringified.length > 800 // unusually large
  ) {
    console.error('[auth] Suppressed log entry — potential credential material detected');
    return;
  }

  const entry = {
    ts: new Date().toISOString(),
    t: type,
    outcome,
    uid: extra.uid || 'anon',
    reason: extra.reason || undefined,
  };

  // Remove undefined
  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }

  // Log level: error for failures, info for success, warn for other
  const level = outcome === 'error' || outcome === 'denied' ? 'warn' : 'info';
  // eslint-disable-next-line no-console
  console[level]('[auth]', JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Log a successful sign-in.
 * @param {string} uid — Supabase user UUID
 */
export function logSignInSuccess(uid) {
  logAuthEvent('SIGN_IN_SUCCESS', 'allowed', { uid });
}

/**
 * Log a failed sign-in attempt.
 * @param {string} reason — machine-readable reason (e.g. Supabase error code)
 */
export function logSignInFailure(reason) {
  logAuthEvent('SIGN_IN_FAILURE', 'denied', { reason: sanitizeReason(reason) });
}

/**
 * Log a successful sign-up.
 * @param {string} uid — Supabase user UUID
 * @param {boolean} needsConfirmation — true if email confirmation required
 */
export function logSignUpSuccess(uid, needsConfirmation) {
  logAuthEvent('SIGN_UP_SUCCESS', 'allowed', {
    uid,
    reason: needsConfirmation ? 'EMAIL_CONFIRMATION_REQUIRED' : undefined,
  });
}

/**
 * Log a failed sign-up.
 * @param {string} reason
 */
export function logSignUpFailure(reason) {
  logAuthEvent('SIGN_UP_FAILURE', 'denied', { reason: sanitizeReason(reason) });
}

/**
 * Log a sign-out event.
 * @param {string} uid
 */
export function logSignOut(uid) {
  logAuthEvent('SIGN_OUT', 'allowed', { uid });
}

/**
 * Log a password reset email send.
 * @param {'success'|'error'} outcome
 * @param {string} [reason] — error reason if outcome = 'error'
 */
export function logPasswordReset(outcome, reason) {
  if (outcome === 'success') {
    logAuthEvent('PASSWORD_RESET_SENT', 'allowed', {});
  } else {
    logAuthEvent('PASSWORD_RESET_ERROR', 'error', { reason: sanitizeReason(reason) });
  }
}

/**
 * Log a password update.
 * @param {string} uid
 * @param {'success'|'error'} outcome
 * @param {string} [reason]
 */
export function logPasswordUpdate(uid, outcome, reason) {
  if (outcome === 'success') {
    logAuthEvent('PASSWORD_UPDATED', 'allowed', { uid });
  } else {
    logAuthEvent('PASSWORD_UPDATE_ERROR', 'error', { uid, reason: sanitizeReason(reason) });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate and sanitise a reason/error message before logging.
 * Prevents accidental credential leakage via error messages from Supabase
 * (e.g. some Supabase errors include partial email in the message).
 *
 * @param {string} [reason]
 * @returns {string}
 */
function sanitizeReason(reason) {
  if (!reason) return 'UNKNOWN';
  const s = String(reason)
    .slice(0, 100)
    .replace(/@[^\s]+/g, '@[redacted]');
  return s;
}
