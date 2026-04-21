/**
 * src/lib/validators.test.js
 * --------------------------
 * FT-011: Test suite for all validators in validators.js.
 *
 * Uses Node.js built-in test runner (node:test + node:assert).
 * No external test framework required — ships with Node 18+.
 *
 * Run:
 *   npm test
 *   node --test src/lib/validators.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateTransaction,
  validateTransactionUpdate,
  validateProject,
  validateSpeechPayload,
  formatValidationErrors,
  VALID_TX_TYPES,
  VALID_CATEGORIES,
  VALID_FUEL_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_DESCRIPTION_LEN,
  MAX_AUDIO_MB,
} from './validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ok(result) {
  assert.equal(
    result.ok,
    true,
    `Expected ok=true but got errors: ${JSON.stringify(result.errors)}`
  );
  return result.value;
}

function fail(result, expectedFragment) {
  assert.equal(result.ok, false, 'Expected ok=false');
  assert.ok(
    result.errors.some((e) => e.toLowerCase().includes(expectedFragment.toLowerCase())),
    `Expected errors to include "${expectedFragment}", got: ${JSON.stringify(result.errors)}`
  );
}

// ---------------------------------------------------------------------------
// validateTransaction
// ---------------------------------------------------------------------------
describe('validateTransaction', () => {
  test('accepts a minimal valid transaction', () => {
    const v = ok(validateTransaction({ type: 'income', amount: 5000 }));
    assert.equal(v.type, 'income');
    assert.equal(v.amount, 5000);
    assert.ok(v.date, 'date should default to now');
  });

  test('accepts client-generated ID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const v = ok(validateTransaction({ type: 'income', amount: 5000, id }));
    assert.equal(v.id, id);
  });

  test('accepts a full valid transaction', () => {
    const v = ok(
      validateTransaction({
        type: 'expense',
        category: 'opex',
        subCategory: 'fuel',
        projectId: 'onion',
        amount: 3200,
        liters: 40,
        fuelType: 'diesel',
        isFuel: true,
        description: 'Tractor refueling',
        date: '2026-04-05T10:00:00.000Z',
      })
    );
    assert.equal(v.type, 'expense');
    assert.equal(v.amount, 3200);
    assert.equal(v.liters, 40);
    assert.equal(v.fuelType, 'diesel');
    assert.equal(v.isFuel, true);
    assert.equal(v.description, 'Tractor refueling');
  });

  test('coerces string amount to float', () => {
    const v = ok(validateTransaction({ type: 'expense', amount: '3200.50' }));
    assert.equal(v.amount, 3200.5);
  });

  test('rejects non-object input', () => {
    fail(validateTransaction(null), 'object');
    fail(validateTransaction('string'), 'object');
    fail(validateTransaction([]), 'object');
  });

  test('rejects missing type', () => {
    fail(validateTransaction({ amount: 100 }), 'type');
  });

  test('rejects invalid type value', () => {
    fail(validateTransaction({ type: 'transfer', amount: 100 }), 'type');
  });

  test('rejects zero amount', () => {
    fail(validateTransaction({ type: 'expense', amount: 0 }), 'greater than 0');
  });

  test('rejects negative amount', () => {
    fail(validateTransaction({ type: 'expense', amount: -100 }), 'greater than 0');
  });

  test('rejects non-numeric amount', () => {
    fail(validateTransaction({ type: 'expense', amount: 'abc' }), 'number');
  });

  test('rejects amount exceeding maximum', () => {
    fail(validateTransaction({ type: 'expense', amount: 9_999_999_999_999 }), 'maximum');
  });

  test('rejects invalid category', () => {
    fail(
      validateTransaction({ type: 'expense', amount: 100, category: 'unknown_cat' }),
      'category'
    );
  });

  test('accepts null category and defaults it', () => {
    const v = ok(validateTransaction({ type: 'expense', amount: 100, category: null }));
    assert.equal(v.category, 'opex'); // default for expense
  });

  test('defaults income category to operationalRevenue', () => {
    const v = ok(validateTransaction({ type: 'income', amount: 100 }));
    assert.equal(v.category, 'operationalRevenue');
  });

  test('rejects negative liters', () => {
    fail(validateTransaction({ type: 'expense', amount: 100, liters: -5 }), 'liters');
  });

  test('rejects unreasonably large liters', () => {
    fail(validateTransaction({ type: 'expense', amount: 100, liters: 200_000 }), 'liters');
  });

  test('accepts liters=0', () => {
    const v = ok(validateTransaction({ type: 'expense', amount: 100, liters: 0 }));
    assert.equal(v.liters, 0);
  });

  test('rejects invalid fuelType', () => {
    fail(validateTransaction({ type: 'expense', amount: 100, fuelType: 'kerosene' }), 'fuelType');
  });

  test('accepts valid fuelTypes', () => {
    for (const ft of VALID_FUEL_TYPES) {
      const v = ok(validateTransaction({ type: 'expense', amount: 100, fuelType: ft }));
      assert.equal(v.fuelType, ft);
    }
  });

  test(`rejects description longer than ${MAX_DESCRIPTION_LEN} chars`, () => {
    fail(
      validateTransaction({
        type: 'expense',
        amount: 100,
        description: 'x'.repeat(MAX_DESCRIPTION_LEN + 1),
      }),
      'description'
    );
  });

  test('accepts description at exactly the limit', () => {
    const v = ok(
      validateTransaction({
        type: 'expense',
        amount: 100,
        description: 'a'.repeat(MAX_DESCRIPTION_LEN),
      })
    );
    assert.equal(v.description.length, MAX_DESCRIPTION_LEN);
  });

  test('strips control characters from description', () => {
    // \x00 (null) and \x07 (BEL) are stripped; regular spaces are preserved
    const v = ok(
      validateTransaction({
        type: 'expense',
        amount: 100,
        description: 'hello \x00world\x07',
      })
    );
    assert.equal(v.description, 'hello world');
  });

  test('rejects invalid ISO date', () => {
    fail(validateTransaction({ type: 'expense', amount: 100, date: 'not-a-date' }), 'date');
  });

  test('accepts YYYY-MM-DD date format', () => {
    const v = ok(validateTransaction({ type: 'expense', amount: 100, date: '2026-04-05' }));
    assert.ok(v.date.startsWith('2026-04-05'));
  });

  test('trims whitespace from string fields', () => {
    const v = ok(
      validateTransaction({
        type: '  expense  ',
        category: '  opex  ',
        amount: 100,
        description: '  padded  ',
      })
    );
    assert.equal(v.type, 'expense');
    assert.equal(v.category, 'opex');
    assert.equal(v.description, 'padded');
  });

  test('accumulates multiple errors', () => {
    const result = validateTransaction({ type: 'bad_type', amount: -5 });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length >= 2, `Expected >= 2 errors, got ${result.errors.length}`);
  });
});

// ---------------------------------------------------------------------------
// validateTransactionUpdate
// ---------------------------------------------------------------------------
describe('validateTransactionUpdate', () => {
  test('accepts a single valid field update', () => {
    const v = ok(validateTransactionUpdate({ amount: 999 }));
    assert.equal(v.amount, 999);
  });

  test('accepts multiple valid fields', () => {
    const v = ok(validateTransactionUpdate({ amount: 500, description: 'updated' }));
    assert.equal(v.amount, 500);
    assert.equal(v.description, 'updated');
  });

  test('accepts version field for OCC', () => {
    const v = ok(validateTransactionUpdate({ amount: 500, version: 2 }));
    assert.equal(v.version, 2);
  });

  test('rejects empty update payload', () => {
    fail(validateTransactionUpdate({}), 'at least one field');
  });

  test('rejects unknown fields (injection prevention)', () => {
    fail(validateTransactionUpdate({ user_id: 'hacked', amount: 100 }), 'unknown');
    fail(validateTransactionUpdate({ farm_id: 'stolen', amount: 100 }), 'unknown');
    fail(validateTransactionUpdate({ deleted_at: '2026-01-01', amount: 100 }), 'unknown');
  });

  test('rejects invalid amount in update', () => {
    fail(validateTransactionUpdate({ amount: 0 }), 'positive');
    fail(validateTransactionUpdate({ amount: -1 }), 'positive');
  });

  test('rejects invalid type in update', () => {
    fail(validateTransactionUpdate({ type: 'refund' }), 'type');
  });

  test('rejects invalid date in update', () => {
    fail(validateTransactionUpdate({ date: 'yesterday' }), 'date');
  });
});

// ---------------------------------------------------------------------------
// validateProject
// ---------------------------------------------------------------------------
describe('validateProject', () => {
  test('accepts a simple ASCII name', () => {
    const v = ok(validateProject({ name: 'Onion Field' }));
    assert.equal(v.label, 'Onion Field');
    assert.equal(v.slug, 'onion_field');
  });

  test('accepts a Cyrillic name', () => {
    const v = ok(validateProject({ name: 'Луковое поле' }));
    assert.equal(v.label, 'Луковое поле');
    assert.equal(v.slug, 'луковое_поле');
  });

  test('rejects an empty name', () => {
    fail(validateProject({ name: '' }), 'required');
    fail(validateProject({ name: '   ' }), 'required');
  });

  test('rejects name exceeding 200 chars', () => {
    fail(validateProject({ name: 'a'.repeat(201) }), '200');
  });

  test('rejects a name that normalises to empty slug', () => {
    fail(validateProject({ name: '!@#$%^&*()' }), 'slug');
  });

  test('accepts label alternative to name key', () => {
    const v = ok(validateProject({ label: 'Wheat Field' }));
    assert.equal(v.label, 'Wheat Field');
  });

  test('slug is capped at 100 chars', () => {
    const v = ok(validateProject({ name: 'a'.repeat(150) }));
    assert.ok(v.slug.length <= 100);
  });
});

// ---------------------------------------------------------------------------
// validateSpeechPayload
// ---------------------------------------------------------------------------
describe('validateSpeechPayload', () => {
  const SMALL_BASE64 = 'SGVsbG8gV29ybGQ='; // "Hello World"

  test('accepts a minimal valid payload', () => {
    const v = ok(validateSpeechPayload({ audioBase64: SMALL_BASE64 }));
    assert.equal(v.rawBase64, SMALL_BASE64);
    assert.equal(v.mimeType, 'audio/webm'); // default
  });

  test('accepts a data URL with audio/webm MIME', () => {
    const v = ok(
      validateSpeechPayload({
        audioBase64: `data:audio/webm;base64,${SMALL_BASE64}`,
        mimeType: 'audio/webm',
      })
    );
    assert.equal(v.rawBase64, SMALL_BASE64);
  });

  test('accepts all supported MIME types', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      ok(validateSpeechPayload({ audioBase64: SMALL_BASE64, mimeType: mime }));
    }
  });

  test('rejects missing audioBase64', () => {
    fail(validateSpeechPayload({}), 'audioBase64');
    fail(validateSpeechPayload({ audioBase64: null }), 'audioBase64');
  });

  test('rejects non-string audioBase64', () => {
    fail(validateSpeechPayload({ audioBase64: 12345 }), 'audioBase64');
  });

  test('rejects unsupported MIME type', () => {
    fail(
      validateSpeechPayload({ audioBase64: SMALL_BASE64, mimeType: 'video/mp4' }),
      'unsupported'
    );
  });

  test(`rejects base64 string exceeding ${MAX_AUDIO_MB} MB limit`, () => {
    // Create a string just over the limit
    const oversize = 'A'.repeat(Math.ceil(MAX_AUDIO_MB * 1024 * 1024 * (4 / 3)) + 100);
    fail(validateSpeechPayload({ audioBase64: oversize }), 'large');
  });

  test('normalises MIME type to lowercase', () => {
    const v = ok(validateSpeechPayload({ audioBase64: SMALL_BASE64, mimeType: 'Audio/WebM' }));
    assert.equal(v.mimeType, 'audio/webm');
  });

  test('rejects non-object body', () => {
    fail(validateSpeechPayload(null), 'object');
    fail(validateSpeechPayload('audio'), 'object');
  });
});

// ---------------------------------------------------------------------------
// formatValidationErrors
// ---------------------------------------------------------------------------
describe('formatValidationErrors', () => {
  test('returns empty string for empty array', () => {
    assert.equal(formatValidationErrors([]), '');
    assert.equal(formatValidationErrors(null), '');
  });

  test('returns single error without numbering', () => {
    assert.equal(formatValidationErrors(['Bad amount']), 'Bad amount');
  });

  test('numbers multiple errors', () => {
    const result = formatValidationErrors(['Error A', 'Error B']);
    assert.ok(result.includes('1.'));
    assert.ok(result.includes('2.'));
    assert.ok(result.includes('Error A'));
    assert.ok(result.includes('Error B'));
  });
});

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------
describe('constants', () => {
  test('VALID_TX_TYPES contains income and expense', () => {
    assert.ok(VALID_TX_TYPES.has('income'));
    assert.ok(VALID_TX_TYPES.has('expense'));
  });

  test('VALID_CATEGORIES contains all expected categories', () => {
    const expected = ['opex', 'capex', 'operationalRevenue', 'subsidies', 'assetSale'];
    for (const c of expected) assert.ok(VALID_CATEGORIES.has(c), `Missing category: ${c}`);
  });

  test('VALID_FUEL_TYPES contains petrol, diesel, propan, other', () => {
    for (const ft of ['petrol', 'diesel', 'propan', 'other']) {
      assert.ok(VALID_FUEL_TYPES.has(ft), `Missing fuel type: ${ft}`);
    }
  });

  test('ALLOWED_MIME_TYPES contains audio/webm and audio/ogg', () => {
    assert.ok(ALLOWED_MIME_TYPES.has('audio/webm'));
    assert.ok(ALLOWED_MIME_TYPES.has('audio/ogg'));
  });
});
