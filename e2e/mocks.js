/**
 * Common Supabase API mocks for Playwright tests.
 *
 * mockSupabaseAuth  — pre-seeds localStorage with a Supabase session token
 *                     (using addInitScript) so the app boots already logged in.
 *                     Also intercepts network routes for token refresh / login.
 * mockSupabaseData  — intercepts Supabase table queries and the /api/analytics
 *                     edge function so data-dependent pages render predictably.
 *
 * IMPORTANT: call mockSupabaseAuth(page) BEFORE page.goto() so addInitScript
 * runs before the page JS executes.
 */

// A minimal fake Supabase session. The access_token is a valid-shaped JWT
// but is not cryptographically real — the Supabase JS SDK reads it from
// localStorage and trusts it without re-verifying the signature client-side.
//
// Payload segment is base64url-encoded without padding (standard JWT format).
const _payloadObj = {
  iss: 'supabase',
  sub: 'test-user-id',
  email: 'test@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};
// Buffer is available in Node.js; browsers don't evaluate this module.
const _payloadB64 = Buffer.from(JSON.stringify(_payloadObj))
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const FAKE_SESSION = {
  access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${_payloadB64}.fake-signature`,
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
  },
};

export const mockSupabaseAuth = async (page) => {
  // Inject the fake session into localStorage BEFORE the page loads.
  // The Supabase JS SDK reads the storageKey ('ferma-tolk-auth') from
  // localStorage in getSession(), so it finds a valid session immediately
  // without needing any network request.
  await page.addInitScript((session) => {
    // Supabase SDK v2 stores the session as JSON under the storageKey.
    localStorage.setItem('ferma-tolk-auth', JSON.stringify(session));
  }, FAKE_SESSION);

  // Also intercept network calls the SDK may still make (token refresh,
  // profile fetch) so they don't fail against a non-existent server.
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('token?grant_type=password')) {
      // Explicit login attempt — return a valid session.
      // Individual tests can override this with their own route.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_SESSION),
      });
    } else {
      // Session refresh, user fetch, etc.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_SESSION),
      });
    }
  });
};

export const mockSupabaseData = async (page) => {
  // --- Server-side analytics edge function (FT-025) --------------------
  // useAppAnalytics fetches /api/analytics (a Vercel edge function),
  // NOT a Supabase RPC. This must be mocked here.
  await page.route('**/api/analytics*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalIncome: 1000,
        totalOpex: 400,
        totalCapex: 100,
        totalExpenses: 500,
        profit: 500,
        balance: 500,
        fuelLiters: 0,
        fuelCost: 0,
        fuelBreakdown: [],
        opexFuel: 0,
        opexSalary: 0,
        opexFood: 0,
        opexBreakdown: [],
        forecastTotal: 0,
        isCurrentMonth: true,
        cycleAnalytics: {
          hasPreviousYearData: false,
          yoyIncomePercent: 0,
          yoyOpexPercent: 0,
          categoryComparisons: [],
        },
        projectBreakdown: [],
      }),
    });
  });

  // --- Paginated transactions (FT-023) ---------------------------------
  await page.route('**/rest/v1/transactions*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'tx-1',
          user_id: 'test-user-id',
          type: 'expense',
          category: 'opex',
          sub_category: 'fuel',
          amount: 100.5,
          description: 'Fuel for tractor',
          entry_date: new Date().toISOString(),
          version: 1,
        },
      ]),
    });
  });

  // --- Projects ---------------------------------------------------------
  await page.route('**/rest/v1/projects*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'onion-uuid', slug: 'onion', label: 'Onion Field', user_id: 'test-user-id' },
      ]),
    });
  });

  // --- Description mappings --------------------------------------------
  await page.route('**/rest/v1/description_mappings*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Taxonomy (opex categories) --------------------------------------
  await page.route('**/rest/v1/transaction_categories*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/transaction_sub_categories*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/opex_sub_categories*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- User preferences (farmId resolution) ----------------------------
  await page.route('**/rest/v1/user_preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ default_farm_id: null }),
    });
  });

  // --- Chat messages ---------------------------------------------------
  await page.route('**/rest/v1/chat_messages*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // --- Forecast adjustments --------------------------------------------
  await page.route('**/rest/v1/forecast_adjustments*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
};
