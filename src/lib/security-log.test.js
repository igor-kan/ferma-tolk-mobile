/**
 * src/lib/security-log.test.js
 * -----------------------------
 * FT-014: Tests for client-side security-log.js and server-side
 * _security-log.js (the schema and safety functions).
 *
 * Run:
 *   node --test src/lib/security-log.test.js
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Client-side security-log.js tests
// ---------------------------------------------------------------------------
import {
  logAuthEvent,
  logSignInSuccess,
  logSignInFailure,
  logSignUpSuccess,
  logSignUpFailure,
  logSignOut,
  logPasswordReset,
  logPasswordUpdate,
} from './security-log.js';

// Capture console output for testing
const captured = [];
const originalWarn = console.warn.bind(console);
const originalInfo = console.info.bind(console);
const originalError = console.error.bind(console);

function captureConsole() {
  console.warn = (...args) => captured.push({ level: 'warn', args });
  console.info = (...args) => captured.push({ level: 'info', args });
  console.error = (...args) => captured.push({ level: 'error', args });
}
function restoreConsole() {
  console.warn = originalWarn;
  console.info = originalInfo;
  console.error = originalError;
  captured.length = 0;
}

function lastLog() {
  return captured[captured.length - 1];
}
function lastLogParsed() {
  const last = lastLog();
  if (!last) return null;
  // args = ['[auth]', '<json string>']
  const jsonStr = last.args[1];
  return JSON.parse(jsonStr);
}

// ---------------------------------------------------------------------------
describe('logAuthEvent — schema', () => {
  beforeEach(() => {
    captureConsole();
    captured.length = 0;
  });
  afterEach(() => restoreConsole());

  test('emits [auth] prefix', () => {
    logAuthEvent('SIGN_IN_SUCCESS', 'allowed');
    assert.equal(lastLog()?.args[0], '[auth]');
  });

  test('always includes ts (ISO-8601)', () => {
    logAuthEvent('SIGN_IN_SUCCESS', 'allowed');
    const e = lastLogParsed();
    assert.ok(e.ts, 'ts should be present');
    assert.ok(!isNaN(new Date(e.ts).getTime()), 'ts should be a valid date');
  });

  test('always includes t and outcome', () => {
    logAuthEvent('SIGN_IN_FAILURE', 'denied', { reason: 'WRONG_PASSWORD' });
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_IN_FAILURE');
    assert.equal(e.outcome, 'denied');
  });

  test('defaults uid to "anon" when not provided', () => {
    logAuthEvent('SIGN_IN_FAILURE', 'denied');
    const e = lastLogParsed();
    assert.equal(e.uid, 'anon');
  });

  test('uses console.warn for denied events', () => {
    logAuthEvent('SIGN_IN_FAILURE', 'denied');
    assert.equal(lastLog()?.level, 'warn');
  });

  test('uses console.info for allowed events', () => {
    logAuthEvent('SIGN_IN_SUCCESS', 'allowed');
    assert.equal(lastLog()?.level, 'info');
  });
});

// ---------------------------------------------------------------------------
describe('logAuthEvent — safety checks', () => {
  beforeEach(() => {
    captureConsole();
    captured.length = 0;
  });
  afterEach(() => restoreConsole());

  test('suppresses event when reason contains JWT-like string', () => {
    logAuthEvent('SIGN_IN_FAILURE', 'denied', { reason: 'eyJhbGciOiJIUzI1NiJ9.token' });
    // Should emit a console.error suppression notice, not a [auth] event
    const last = lastLog();
    assert.ok(
      !last || last.args[0] !== '[auth]' || !last.args[1]?.includes('eyJ'),
      'JWT should not appear in output'
    );
  });

  test('suppresses event when extra fields are too large', () => {
    const huge = { reason: 'x'.repeat(900) };
    logAuthEvent('SIGN_UP_FAILURE', 'denied', huge);
    // Either suppressed or truncated — should not be a 900-char log line
    const last = lastLog();
    if (last?.args[1]) {
      assert.ok(last.args[1].length < 900, 'log entry should be size-limited');
    }
  });

  test('sanitises email addresses in reason strings', () => {
    logSignInFailure('User not found: alice@example.com');
    const e = lastLogParsed();
    assert.ok(!e?.reason?.includes('alice@example.com'), 'email should be redacted');
    assert.ok(e?.reason?.includes('[redacted]'), 'should show [redacted]');
  });
});

// ---------------------------------------------------------------------------
describe('convenience wrappers', () => {
  beforeEach(() => {
    captureConsole();
    captured.length = 0;
  });
  afterEach(() => restoreConsole());

  test('logSignInSuccess emits SIGN_IN_SUCCESS with uid', () => {
    logSignInSuccess('user-uuid-123');
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_IN_SUCCESS');
    assert.equal(e.outcome, 'allowed');
    assert.equal(e.uid, 'user-uuid-123');
  });

  test('logSignInFailure emits SIGN_IN_FAILURE as denied', () => {
    logSignInFailure('Invalid login credentials');
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_IN_FAILURE');
    assert.equal(e.outcome, 'denied');
    assert.ok(e.reason, 'reason should be present');
  });

  test('logSignUpSuccess with confirmation flag', () => {
    logSignUpSuccess('new-user-uuid', true);
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_UP_SUCCESS');
    assert.equal(e.reason, 'EMAIL_CONFIRMATION_REQUIRED');
  });

  test('logSignUpSuccess without confirmation', () => {
    logSignUpSuccess('new-user-uuid', false);
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_UP_SUCCESS');
    assert.ok(!e.reason, 'reason should be absent when no confirmation needed');
  });

  test('logSignUpFailure emits SIGN_UP_FAILURE', () => {
    logSignUpFailure('Email already registered');
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_UP_FAILURE');
    assert.equal(e.outcome, 'denied');
  });

  test('logSignOut emits SIGN_OUT with uid', () => {
    logSignOut('user-abc');
    const e = lastLogParsed();
    assert.equal(e.t, 'SIGN_OUT');
    assert.equal(e.uid, 'user-abc');
  });

  test('logPasswordReset success', () => {
    logPasswordReset('success');
    const e = lastLogParsed();
    assert.equal(e.t, 'PASSWORD_RESET_SENT');
    assert.equal(e.outcome, 'allowed');
  });

  test('logPasswordReset error', () => {
    logPasswordReset('error', 'Rate limit exceeded');
    const e = lastLogParsed();
    assert.equal(e.t, 'PASSWORD_RESET_ERROR');
    assert.equal(e.outcome, 'error');
  });

  test('logPasswordUpdate success', () => {
    logPasswordUpdate('user-xyz', 'success');
    const e = lastLogParsed();
    assert.equal(e.t, 'PASSWORD_UPDATED');
    assert.equal(e.uid, 'user-xyz');
  });

  test('logPasswordUpdate error', () => {
    logPasswordUpdate('user-xyz', 'error', 'Password too short');
    const e = lastLogParsed();
    assert.equal(e.t, 'PASSWORD_UPDATE_ERROR');
    assert.equal(e.outcome, 'error');
  });
});

// ---------------------------------------------------------------------------
// Server-side _security-log.js tests (schema + extractRequestMeta)
// ---------------------------------------------------------------------------
import { extractRequestMeta, secLogSync } from '../../api/_security-log.js';

// Minimal Request mock for Node
class MockRequest {
  constructor({ url = 'https://example.com/api/speech', method = 'POST', headers = {} } = {}) {
    this.url = url;
    this.method = method;
    this._headers = new Map(Object.entries(headers));
  }
  headers = {
    get: (k) => this._headers.get(k.toLowerCase()) ?? null,
  };
}

describe('extractRequestMeta', () => {
  test('extracts endpoint and method from request', () => {
    const req = new MockRequest({ url: 'https://app.vercel.app/api/speech', method: 'POST' });
    req.headers = {
      get: (k) => (k === 'cf-connecting-ip' ? null : k === 'x-forwarded-for' ? '1.2.3.4' : null),
    };
    const meta = extractRequestMeta(req);
    assert.equal(meta.endpoint, '/api/speech');
    assert.equal(meta.method, 'POST');
  });

  test('extracts IP from x-forwarded-for', () => {
    const req = new MockRequest();
    req.headers = { get: (k) => (k === 'x-forwarded-for' ? '10.0.0.1, 172.16.0.1' : null) };
    const meta = extractRequestMeta(req);
    assert.equal(meta.ip, '10.0.0.1');
  });

  test('extracts IP from cf-connecting-ip preferentially', () => {
    const req = new MockRequest();
    req.headers = {
      get: (k) =>
        k === 'cf-connecting-ip' ? '1.2.3.4' : k === 'x-forwarded-for' ? '10.0.0.1' : null,
    };
    const meta = extractRequestMeta(req);
    assert.equal(meta.ip, '1.2.3.4');
  });

  test('truncates user-agent to 120 chars', () => {
    const req = new MockRequest();
    const longUa = 'Mozilla/' + 'x'.repeat(200);
    req.headers = { get: (k) => (k === 'user-agent' ? longUa : null) };
    const meta = extractRequestMeta(req);
    assert.ok(meta.ua.length <= 120, 'ua should be truncated');
  });

  test('returns "unknown" for missing IP', () => {
    const req = new MockRequest();
    req.headers = { get: () => null };
    const meta = extractRequestMeta(req);
    assert.equal(meta.ip, 'unknown');
  });

  test('handles null req gracefully', () => {
    const meta = extractRequestMeta(null);
    assert.equal(meta.endpoint, 'unknown');
    assert.equal(meta.ip, 'unknown');
  });
});

describe('secLogSync — schema', () => {
  beforeEach(() => {
    captureConsole();
    captured.length = 0;
  });
  afterEach(() => restoreConsole());

  test('emits [sec] prefix', () => {
    const req = new MockRequest();
    req.headers = { get: () => null };
    secLogSync(req, { t: 'AUTH_FAILURE', outcome: 'denied', status: 401 });
    const last = lastLog();
    assert.equal(last?.args[0], '[sec]');
  });

  test('always includes ts, t, outcome, endpoint', () => {
    const req = new MockRequest({ url: 'https://host/api/speech' });
    req.headers = { get: () => null };
    secLogSync(req, { t: 'AUTH_FAILURE', outcome: 'denied', uid: 'anon' });
    const e = JSON.parse(lastLog().args[1]);
    assert.ok(e.ts, 'ts present');
    assert.ok(e.t, 't present');
    assert.ok(e.outcome, 'outcome present');
    assert.ok(e.endpoint, 'endpoint present');
  });

  test('never includes JWT-like strings in output', () => {
    const req = new MockRequest();
    req.headers = { get: () => null };
    // Attempt to inject a fake JWT
    secLogSync(req, {
      t: 'TEST',
      outcome: 'denied',
      uid: 'eyJhbGciOiJIUzI1NiJ9.fakejwt',
    });
    // If the safety check fires, a console.error is emitted instead
    const last = lastLog();
    const serialized = JSON.stringify(last?.args || []);
    assert.ok(!serialized.includes('.fakejwt'), 'JWT content must not appear in logs');
  });
});
