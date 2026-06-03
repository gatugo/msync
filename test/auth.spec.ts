import { test, expect } from '@playwright/test';

test.describe('Authentication Redirects', () => {
  test('should redirect unauthenticated user from main page to login', async ({ page }) => {
    // Attempt to access a protected route (which is the root in this app)
    await page.goto('/');

    // Wait for the hydration loading screen to disappear
    await expect(page.locator('text=Loading...')).toBeHidden({ timeout: 10000 });

    // Ensure they are redirected to the login view 
    // In this app, the root path '/' hosts both login and the main app conditionally based on auth state.
    // If not logged in, we should see the "Sign in to continue" prompt.
    const loginHeading = page.locator('text=Sign in to continue');
    await expect(loginHeading).toBeVisible();

    // Verify the main timeline UI is hidden
    const mainHeading = page.locator('text=MindSync').first();
    // Since MindSync might be the brand title on the login page too, let's look for a specific dashboard element
    const timelineLabel = page.locator('text=Today');
    await expect(timelineLabel).toBeHidden();
  });
});
