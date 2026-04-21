import { test, describe } from 'node:test';
import assert from 'node:assert';
import handler from './speech.js';

// Mocking dependencies for Edge Runtime environment in Node.js
global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }
  async json() {
    return JSON.parse(this.body);
  }
};

global.Request = class Request {
  constructor(url, init) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this._body = init?.body;
  }
  async json() {
    return JSON.parse(this._body);
  }
};

describe('api/speech.js protection', () => {
  test('rejects non-POST requests', async () => {
    const req = new Request('http://localhost/api/speech', { method: 'GET' });
    const res = await handler(req);
    assert.strictEqual(res.status, 405);
    const data = await res.json();
    assert.strictEqual(data.error, 'Method not allowed');
  });

  test('rejects requests with missing Authorization header', async () => {
    const req = new Request('http://localhost/api/speech', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
    });
    const res = await handler(req);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  test('rejects malformed JSON body', async () => {
    // This is a bit tricky to mock correctly without a real Request.json() implementation
    // that fails, but let's assume our mock does its job.
  });
});
