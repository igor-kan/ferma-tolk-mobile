import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, mockSupabaseData } from './mocks';

test.describe('Assistant', () => {
  test.beforeEach(async ({ page }) => {
    // Register mocks BEFORE goto so session and data calls are intercepted.
    await mockSupabaseAuth(page);
    await mockSupabaseData(page);
    await page.goto('/');

    // Navigate to the assistant tab.
    // BottomNav uses: language === 'ru' ? 'Чат' : 'Chat' for the assistant tab.
    await page.click('button:has-text("Чат")');
  });

  test('should display assistant page', async ({ page }) => {
    // The Assistant component renders an h2 with 'Ассистент' (Russian).
    // Use getByRole to avoid strict-mode ambiguity with other text nodes.
    await expect(page.getByRole('heading', { name: 'Ассистент' })).toBeVisible({
      timeout: 10000,
    });

    // The chat input placeholder is 'Спросите что-нибудь...' in Russian.
    await expect(page.getByPlaceholder('Спросите что-нибудь...')).toBeVisible();
  });
});
