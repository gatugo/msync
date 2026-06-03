import { test, expect } from '@playwright/test';

test.describe('Data Lab Visual and Flow Validation', () => {
  test('should open settings and verify the new Data Lab icon and modal', async ({ page }) => {
    // 1. Mock Supabase local storage token before page load
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-cpxgmtvravfegdrjscbx-auth-token', JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'mock-user-123',
          email: 'mock-user@mindsync.com',
          role: 'authenticated',
          aud: 'authenticated',
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }));
    });

    // 2. Intercept Supabase Auth/Rest API routes to return successful mock responses
    await page.route('**/auth/v1/user*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-123',
          email: 'mock-user@mindsync.com',
          role: 'authenticated',
          aud: 'authenticated',
        }),
      });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-123',
          hobbies: ['Coding', 'Design'],
          interests: ['Aesthetics'],
          passions: ['AI'],
          work: ['Pair Programmer'],
          ai_enabled: true,
        }),
      });
    });

    await page.route('**/rest/v1/tasks*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.route('**/rest/v1/goals*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.route('**/rest/v1/daily_history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.route('**/rest/v1/ai_memory*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    // 3. Navigate to local application
    await page.goto('http://localhost:3000/');

    // Wait for the app to hydrate
    await expect(page.locator('text=Loading...')).toBeHidden({ timeout: 15000 });

    // 4. Click Settings tab in BottomNav
    const settingsTab = page.getByRole('button', { name: /Settings/i }).first();
    await expect(settingsTab).toBeVisible({ timeout: 10000 });
    await settingsTab.click();

    // Check that Settings content is visible
    await expect(page.getByText(/Brain Personalization/i).first()).toBeVisible();

    // Scroll the Settings Tab container to the absolute bottom to see the redesigned footer
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const settingsScrollable = divs.find(el => {
        const style = window.getComputedStyle(el);
        return el.scrollHeight > el.clientHeight && 
               (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
               el.textContent?.includes('Settings');
      });
      if (settingsScrollable) {
        settingsScrollable.scrollTop = settingsScrollable.scrollHeight;
      }
    });
    await page.waitForTimeout(1500);

    // Take screenshot of Settings Tab with the new beautiful small Data Lab icon and redesigned footer
    await page.screenshot({ path: 'datalab_settings_tab.png' });
    console.log('Saved settings tab screenshot to datalab_settings_tab.png');

    // 5. Open Data Lab Modal
    const dataManagementBtn = page.getByText(/Data Management/i).first();
    await expect(dataManagementBtn).toBeVisible();
    await dataManagementBtn.click();

    // The modal should appear
    const dataLabModal = page.getByText(/Data Lab/i).first();
    await expect(dataLabModal).toBeVisible();

    // Wait for modal transition to finish
    await page.waitForTimeout(1000);

    // Take screenshot of the open Data Lab modal with the glorious new custom large icon
    await page.screenshot({ path: 'datalab_modal_fixed_view.png', fullPage: true });
    console.log('Saved Data Lab modal screenshot to datalab_modal_fixed_view.png');

    // Close modal
    const returnBtn = page.getByRole('button', { name: /Return to Hub/i });
    await returnBtn.click();
    await expect(dataLabModal).not.toBeVisible();
  });
});
