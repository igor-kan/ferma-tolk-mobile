import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, mockSupabaseData } from './mocks';

test.describe('Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Register mocks BEFORE goto so session and data calls are intercepted.
    await mockSupabaseAuth(page);
    await mockSupabaseData(page);
    await page.goto('/');

    // Navigate to the transactions tab.
    // BottomNav renders the label via i18n: t('history', 'ru') = 'История'.
    await page.click('button:has-text("История")');
  });

  test('should display a list of transactions', async ({ page }) => {
    // The mocked transaction has description: 'Fuel for tractor'.
    await expect(page.getByText('Fuel for tractor')).toBeVisible({ timeout: 10000 });
  });

  test('should open add transaction modal', async ({ page }) => {
    // The FAB (floating action button) in BottomNav has id='add'.
    // It has no visible text label — only a PlusCircle icon.
    // Click it via its position in the nav (third button = index 2).
    const navButtons = page.locator('nav button');
    await navButtons.nth(2).click();

    // AddEntry mounts in the main area when activeTab === 'add'.
    // The voice/keyboard mode toggle is present — wait for any AddEntry element.
    await expect(page.getByText('Голос').or(page.getByText('Voice'))).toBeVisible({
      timeout: 10000,
    });
  });
});
