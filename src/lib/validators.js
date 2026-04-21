/**
 * src/lib/validators.js
 * ----------------------
 * FT-011: Shared input validation for transaction, audio, and project payloads.
 * FT-021: Introduce typed API/data contracts using Zod.
 */

import {
  TransactionSchema,
  TransactionUpdateSchema,
  ProjectSchema,
  SpeechPayloadSchema,
  VALID_TX_TYPES,
  VALID_CATEGORIES,
  VALID_FUEL_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_AUDIO_MB,
  MAX_AUDIO_BYTES,
  MAX_BASE64_CHARS,
  MAX_BODY_BYTES,
  MAX_DESCRIPTION_LEN,
  MAX_PROJECT_SLUG_LEN,
  MAX_PROJECT_LABEL_LEN,
  MAX_AMOUNT,
} from './schemas.js';

export {
  VALID_TX_TYPES,
  VALID_CATEGORIES,
  VALID_FUEL_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_AUDIO_MB,
  MAX_AUDIO_BYTES,
  MAX_BASE64_CHARS,
  MAX_BODY_BYTES,
  MAX_DESCRIPTION_LEN,
  MAX_PROJECT_SLUG_LEN,
  MAX_PROJECT_LABEL_LEN,
  MAX_AMOUNT,
};

function formatZodErrors(result) {
  const errs = result.error?.errors || result.error?.issues || result.issues;
  if (Array.isArray(errs)) {
    return errs.map((e) => e.message);
  }
  return ['Validation failed'];
}

/**
 * Validate a transaction payload before writing to the database.
 * @param {object} raw
 * @returns {{ ok: boolean, value?: object, errors?: string[] }}
 */
export function validateTransaction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Transaction must be an object'] };
  }
  const result = TransactionSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result) };
  }
  return { ok: true, value: result.data };
}

/**
 * Validate a partial transaction update.
 * @param {object} raw
 * @returns {{ ok: boolean, value?: object, errors?: string[] }}
 */
export function validateTransactionUpdate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Update payload must be an object'] };
  }
  const result = TransactionUpdateSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result) };
  }
  return { ok: true, value: result.data };
}

/**
 * Validate a new project payload.
 * @param {{ name: string }} raw
 * @returns {{ ok: boolean, value?: { slug: string, label: string }, errors?: string[] }}
 */
export function validateProject(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Project must be an object'] };
  }
  const result = ProjectSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result) };
  }
  return { ok: true, value: result.data };
}

/**
 * Validate the JSON body sent to api/speech.js.
 * @param {{ audioBase64: string, mimeType?: string }} raw
 * @returns {{ ok: boolean, value?: { rawBase64: string, mimeType: string }, errors?: string[] }}
 */
export function validateSpeechPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object'] };
  }
  const result = SpeechPayloadSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: formatZodErrors(result) };
  }
  return { ok: true, value: result.data };
}

/**
 * Converts an errors string array to a single human-readable message.
 * @param {string[]} errors
 * @returns {string}
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
}
