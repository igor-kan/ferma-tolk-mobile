/**
 * Client-side credential hashing using Web Crypto PBKDF2.
 *
 * WHY THIS EXISTS
 * ---------------
 * FT-003 requires that no plaintext password or secret answer is ever stored
 * in localStorage, React state, or any persistent client-side store.
 *
 * Until a server-side auth system is in place (BLOCKER-02 in SECURITY-BASELINE.md),
 * this module provides the strongest credential protection available in the browser:
 * PBKDF2-SHA-256 with a 16-byte random salt and 200 000 iterations. The output is
 * a hex string of the form "<salt_hex>:<hash_hex>" — safe for localStorage storage
 * because the raw password cannot be recovered from it.
 *
 * LIMITATIONS (acknowledged, tracked as BLOCKER-02)
 * ---------------------------------------------------
 * - This is still client-side hashing. A server-side bcrypt/argon2 implementation
 *   is required before production. This module is an interim hardening step.
 * - The salt is random per-hash, so the stored value changes on every registration
 *   or password change.
 * - 200 000 PBKDF2 iterations is the OWASP 2023 minimum for SHA-256. Adjust upward
 *   as hardware improves.
 */

const ITERATIONS = 200_000;
const HASH_ALG = 'SHA-256';
const KEY_LENGTH = 32; // bytes → 256 bits

/**
 * Encode a Uint8Array to a lowercase hex string.
 */
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a plaintext credential (password or secret answer) with a fresh random salt.
 * Returns a Promise that resolves to "<saltHex>:<hashHex>".
 *
 * @param {string} plaintext
 * @returns {Promise<string>}
 */
export async function hashCredential(plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plaintext),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALG,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  return `${saltHex}:${toHex(bits)}`;
}

/**
 * Verify a plaintext credential against a stored "<saltHex>:<hashHex>" string.
 * Returns a Promise<boolean>.
 *
 * @param {string} plaintext
 * @param {string} storedHash  "<saltHex>:<hashHex>"
 * @returns {Promise<boolean>}
 */
export async function verifyCredential(plaintext, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;

  const [saltHex, expectedHex] = storedHash.split(':');

  // Rebuild the salt Uint8Array from hex
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plaintext),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALG,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const actualHex = toHex(bits);

  // Constant-time comparison to avoid timing attacks
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) {
    diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Detect whether a stored value is already a hashed credential
 * (i.e. produced by hashCredential) or is still plaintext.
 * Format: 32 hex chars (salt) + ':' + 64 hex chars (hash) = 97 chars total.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isHashed(value) {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(value);
}
