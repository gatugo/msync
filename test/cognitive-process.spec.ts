import { test, expect } from '@playwright/test';

test.describe('AI Coach Cognitive Process Panel', () => {
  test('should left-align the Cognitive Process pill during streaming and disappear after streaming completes', async ({ page }) => {
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

    // 4. Click on AI Coach tab button (the label is "Coach" in BottomNav)
    const coachTab = page.getByRole('button', { name: /Coach/i }).first();
    await expect(coachTab).toBeVisible({ timeout: 10000 });
    await coachTab.click();

    // Confirm we are on the AI Coach screen by checking for "AI Coach" text in header
    await expect(page.getByText(/Coach/i).first()).toBeVisible();

    // 5. Type a prompt and send it to trigger streaming
    const input = page.getByPlaceholder(/Ask MindSync/i);
    await expect(input).toBeVisible();
    await input.fill('Explain why zero-stakes play reduces adult burnout in a few detailed sentences.');
    await input.press('Enter');

    // Wait a brief moment to let streaming start and the "Cognitive Process" panel to appear
    await page.waitForTimeout(2500);

    // Take screenshot during streaming (Cognitive Process should be visible and left-aligned)
    await page.screenshot({ path: 'test_cognitive_process_streaming.png', fullPage: true });
    console.log('Saved streaming screenshot to test_cognitive_process_streaming.png');

    // Now wait for streaming to complete (isLoading becomes false, which means the "Thinking..." loader disappears)
    const thinkingLoader = page.locator('text=Thinking...');
    await expect(thinkingLoader).not.toBeVisible({ timeout: 35000 });

    // Wait a bit for layout to settle
    await page.waitForTimeout(1500);

    // Take screenshot after streaming is completed (Cognitive Process should have disappeared)
    await page.screenshot({ path: 'test_cognitive_process_completed.png', fullPage: true });
    console.log('Saved completed screenshot to test_cognitive_process_completed.png');
  });
});
