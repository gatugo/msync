import { test, expect } from '@playwright/test';

test.describe('MindSync App', () => {
  test('should show login screen when not authenticated', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for dark background (login page)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Wait for the hydration loading screen to disappear
    await expect(page.locator('text=Loading...')).toBeHidden({ timeout: 10000 });

    // Check if we see login prompt
    const loginHeading = page.locator('text=Sign in to continue');
    await expect(loginHeading).toBeVisible();

    console.log('✅ Login page is showing');

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-screenshot.png', fullPage: true });

    // Check for any errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Print any errors found
    if (errors.length > 0) {
      console.log('❌ Page errors:', errors);
    } else {
      console.log('✅ No page errors detected');
    }
  });

  test('should check console for errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000); // Wait 3 seconds for everything to load

    if (consoleErrors.length > 0) {
      console.log('❌ Console errors:', consoleErrors);
    } else {
      console.log('✅ No console errors');
    }

    if (consoleWarnings.length > 0) {
      console.log('⚠️ Console warnings:', consoleWarnings);
    }
  });
});
