/**
 * scripts/smoke-test.js (FT-034)
 * ------------------------------
 * A simple health check script to verify that a deployed environment (Staging/Production)
 * is responding and its basic security guards are active.
 *
 * Usage:
 *   URL=https://staging.example.com node scripts/smoke-test.js
 */

const targetUrl = process.env.URL;

if (!targetUrl) {
  console.error('❌ Error: URL environment variable is required.');
  process.exit(1);
}

console.log(`--- Smoke Test: ${targetUrl} ---`);

async function runTests() {
  const results = [];

  // 1. Frontend availability
  try {
    const res = await fetch(targetUrl);
    results.push({ name: 'Frontend renders', ok: res.ok, status: res.status });
  } catch (e) {
    results.push({ name: 'Frontend renders', ok: false, error: e.message });
  }

  // 2. API: Speech endpoint protection (Method Guard)
  try {
    const res = await fetch(`${targetUrl}/api/speech`, { method: 'GET' });
    // Should be 405 Method Not Allowed
    results.push({
      name: 'API: /api/speech Method Guard',
      ok: res.status === 405,
      status: res.status,
    });
  } catch (e) {
    results.push({ name: 'API: /api/speech Method Guard', ok: false, error: e.message });
  }

  // 3. API: Speech endpoint protection (Auth Guard)
  try {
    const res = await fetch(`${targetUrl}/api/speech`, { method: 'POST' });
    // Should be 401 Unauthorized
    results.push({
      name: 'API: /api/speech Auth Guard',
      ok: res.status === 401,
      status: res.status,
    });
  } catch (e) {
    results.push({ name: 'API: /api/speech Auth Guard', ok: false, error: e.message });
  }

  // 4. API: Analytics endpoint protection
  try {
    const res = await fetch(`${targetUrl}/api/analytics?month=0&year=2026`);
    // Should be 401 Unauthorized
    results.push({
      name: 'API: /api/analytics Auth Guard',
      ok: res.status === 401,
      status: res.status,
    });
  } catch (e) {
    results.push({ name: 'API: /api/analytics Auth Guard', ok: false, error: e.message });
  }

  // Summary
  console.table(results);

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`❌ Smoke test failed with ${failures.length} errors.`);
    process.exit(1);
  } else {
    console.log('✅ Smoke test passed successfully.');
    process.exit(0);
  }
}

runTests();
