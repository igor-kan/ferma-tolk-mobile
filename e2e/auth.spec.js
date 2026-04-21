import { test, expect } from '@playwright/test';
import { mockSupabaseData } from './mocks';

test.describe('Authentication', () => {
  test('should log in successfully', async ({ page }) => {
    // Ensure localStorage is empty (no pre-seeded session) so the app shows
    // the login form, then mock the login endpoint to return a valid session.
    await page.addInitScript(() => {
      localStorage.removeItem('ferma-tolk-auth');
    });

    // Mock all Supabase data so the dashboard loads after login.
    await mockSupabaseData(page);

    // Mock login endpoint: return a valid session when credentials are submitted.
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.fake',
          refresh_token: 'fake-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: { id: 'test-user-id', email: 'test@example.com', role: 'authenticated' },
        }),
      });
    });

    await page.goto('/');

    // The app boots with no session → shows login form.
    await expect(page.getByRole('heading', { name: 'Вход в аккаунт' })).toBeVisible({
      timeout: 5000,
    });

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // After sign-in, onAuthStateChange fires → App renders the main layout.
    // BottomNav 'Главная' tab label confirms we passed the auth gate.
    await expect(page.getByText('Главная')).toBeVisible({ timeout: 10000 });
  });

  test('should show error on failed login', async ({ page }) => {
    // No session in storage → login form shown.
    await page.addInitScript(() => {
      localStorage.removeItem('ferma-tolk-auth');
    });

    // Mock a failed login attempt.
    await page.route('**/auth/v1/token?grant_type=password', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Неверный Email или пароль')).toBeVisible({ timeout: 5000 });
  });
});
