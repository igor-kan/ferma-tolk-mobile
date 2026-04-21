import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, mockSupabaseData } from './mocks';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Register all mocks BEFORE goto so the session bootstrap and
    // /api/analytics requests are intercepted on first load.
    await mockSupabaseAuth(page);
    await mockSupabaseData(page);
    await page.goto('/');
  });

  test('should display dashboard stats', async ({ page }) => {
    // The Dashboard renders stat cards with translated labels from i18n.
    // 'Общий Доход' (totalIncome) is always shown regardless of the data value.
    // Wait for the card label to confirm the component has mounted.
    await expect(page.getByText('Общий Доход')).toBeVisible({ timeout: 10000 });

    // The BottomNav 'Главная' tab confirms we are on the dashboard tab.
    await expect(page.getByText('Главная')).toBeVisible();
  });
});
