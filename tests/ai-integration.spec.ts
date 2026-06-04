import { test, expect } from '@playwright/test';

test.describe('StepFun AI Integration & Offline Mode', () => {
  test('should have offline and auto-arrange toggles in Settings', async ({ page }) => {
    // Basic test to verify the UI loads and toggles are present
    // Inject test mode flag to bypass Supabase auth
    await page.addInitScript(() => {
      localStorage.setItem('mindsync_test_mode', 'true');
    });
    await page.goto('/');
    
    // Wait for the app to initialize
    await page.waitForLoadState('networkidle');

    // Click on the Settings tab (assuming it has a specific icon or text)
    await page.getByRole('button', { name: /Settings/i }).click();
    // We are looking for the 'Enable AI Intelligence' text
    await expect(page.locator('text=Enable AI Intelligence')).toBeVisible();
    await expect(page.locator('text=Auto-Arrange Tasks')).toBeVisible();
    await expect(page.locator('text=Force Offline Mode')).toBeVisible();
  });
});
