/**
 * src/lib/storage.js
 * ------------------
 * FT-012: Safe localStorage wrapper.
 *
 * Problems solved:
 *   1. QuotaExceededError  — browser storage full; write fails silently
 *      in current code.  This wrapper catches it, logs a structured event,
 *      and returns a typed result so callers can react appropriately.
 *
 *   2. Corrupt JSON       — a truncated or tampered JSON blob causes
 *      JSON.parse to throw.  The wrapper catches, logs, and returns the
 *      fallback value so the app uses a safe default instead of crashing.
 *
 *   3. Storage blocked    — Private Browsing / Firefox strict mode /
 *      some WebViews throw SecurityError when accessing localStorage.
 *      Every operation is wrapped so the app degrades gracefully.
 *
 *   4. Silent failures    — previous code used `catch { }` or
 *      `catch { console.error(...) }` inconsistently.  This module emits
 *      structured `[storage]` log lines on every failure so they are
 *      visible in production logging dashboards.
 *
 * API:
 *   safeGet(key, fallback?)   → value | fallback
 *   safeGetJSON(key, fallback?) → parsed | fallback
 *   safeSet(key, value)       → { ok: boolean, error?: StorageError }
 *   safeSetJSON(key, value)   → { ok: boolean, error?: StorageError }
 *   safeRemove(key)           → void (never throws)
 *   safeRemoveMany(keys)      → void
 *   isStorageAvailable()      → boolean
 *
 * Error types emitted in [storage] log lines:
 *   QUOTA_EXCEEDED     — write failed because quota is full
 *   CORRUPT_JSON       — read succeeded but JSON.parse threw
 *   STORAGE_BLOCKED    — SecurityError accessing localStorage
 *   UNEXPECTED         — any other unexpected error
 *
 * Ticket: FT-012
 */

// ---------------------------------------------------------------------------
// Structured logger
// ---------------------------------------------------------------------------
/**
 * Emit a structured log line visible in browser DevTools and Vercel log tail.
 * @param {'warn'|'error'} level
 * @param {string} type    — one of the error types above
 * @param {string} key     — localStorage key involved
 * @param {string} message — human-readable summary
 * @param {unknown} [detail] — optional extra context (not user data)
 */
function logStorageEvent(level, type, key, message, detail) {
  const entry = { t: type, key, msg: message };
  if (detail !== undefined) entry.detail = String(detail).slice(0, 200);
  // eslint-disable-next-line no-console
  console[level]('[storage]', JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// isStorageAvailable
// ---------------------------------------------------------------------------
let _storageAvailable = null;

/**
 * Returns true if localStorage is accessible in this browser context.
 * Result is memoised after the first call.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  if (_storageAvailable !== null) return _storageAvailable;
  try {
    const probe = '__ferma_storage_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    _storageAvailable = true;
  } catch {
    _storageAvailable = false;
    logStorageEvent(
      'warn',
      'STORAGE_BLOCKED',
      '(probe)',
      'localStorage is not accessible in this browser context'
    );
  }
  return _storageAvailable;
}

// ---------------------------------------------------------------------------
// safeGet — read raw string
// ---------------------------------------------------------------------------
/**
 * Read a raw string from localStorage.
 * Returns `fallback` (default: null) on any error.
 *
 * @param {string} key
 * @param {string|null} [fallback=null]
 * @returns {string|null}
 */
export function safeGet(key, fallback = null) {
  if (!isStorageAvailable()) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch (err) {
    const type = err?.name === 'SecurityError' ? 'STORAGE_BLOCKED' : 'UNEXPECTED';
    logStorageEvent('warn', type, key, `getItem failed: ${err.message}`);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// safeGetJSON — read and parse JSON
// ---------------------------------------------------------------------------
/**
 * Read and JSON.parse a value from localStorage.
 * Returns `fallback` if the key is missing, if storage is blocked,
 * or if the stored value is corrupt JSON.
 *
 * @template T
 * @param {string} key
 * @param {T} [fallback=null]
 * @returns {T}
 */
export function safeGetJSON(key, fallback = null) {
  const raw = safeGet(key, null);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw);
  } catch (_err) {
    // The value exists but is not valid JSON — log it and remove it so the
    // app doesn't keep hitting this on every render.
    logStorageEvent(
      'warn',
      'CORRUPT_JSON',
      key,
      `JSON.parse failed — removing corrupt entry. Preview: ${raw.slice(0, 80)}`
    );
    safeRemove(key);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// safeSet — write raw string
// ---------------------------------------------------------------------------
/**
 * Write a raw string to localStorage.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 *
 * @param {string} key
 * @param {string} value
 * @returns {{ ok: boolean, error?: { type: string, message: string } }}
 */
export function safeSet(key, value) {
  if (!isStorageAvailable()) {
    return {
      ok: false,
      error: { type: 'STORAGE_BLOCKED', message: 'localStorage not available' },
    };
  }

  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (err) {
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    const type = isQuota ? 'QUOTA_EXCEEDED' : 'UNEXPECTED';
    const message = err?.message || 'Unknown storage error';

    logStorageEvent(
      'error',
      type,
      key,
      isQuota
        ? `localStorage quota exceeded while writing "${key}" (${value.length} chars)`
        : `setItem failed: ${message}`
    );

    return { ok: false, error: { type, message } };
  }
}

// ---------------------------------------------------------------------------
// safeSetJSON — JSON.stringify then write
// ---------------------------------------------------------------------------
/**
 * JSON.stringify and write a value to localStorage.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {{ ok: boolean, error?: { type: string, message: string } }}
 */
export function safeSetJSON(key, value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (err) {
    logStorageEvent('error', 'UNEXPECTED', key, `JSON.stringify failed: ${err.message}`);
    return { ok: false, error: { type: 'UNEXPECTED', message: err.message } };
  }
  return safeSet(key, serialized);
}

// ---------------------------------------------------------------------------
// safeRemove
// ---------------------------------------------------------------------------
/**
 * Remove a key from localStorage. Never throws.
 * @param {string} key
 */
export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op: removal failure is not actionable */
  }
}

// ---------------------------------------------------------------------------
// safeRemoveMany
// ---------------------------------------------------------------------------
/**
 * Remove multiple keys. Never throws.
 * @param {string[]} keys
 */
export function safeRemoveMany(keys) {
  for (const key of keys) safeRemove(key);
}

// ---------------------------------------------------------------------------
// safeKeys — list keys with a given prefix
// ---------------------------------------------------------------------------
/**
 * Return all localStorage keys that start with `prefix`.
 * Returns [] if storage is blocked.
 *
 * @param {string} prefix
 * @returns {string[]}
 */
export function safeKeys(prefix = '') {
  if (!isStorageAvailable()) return [];
  const result = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) result.push(k);
    }
  } catch {
    /* blocked */
  }
  return result;
}
