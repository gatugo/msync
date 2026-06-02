import { test, expect } from '@playwright/test';

test.describe('Calendar Header Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase Auth GET User calls just in case client validates with server
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-uuid-12345',
          email: 'demo@example.com',
          role: 'authenticated',
          aud: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    });

    // Intercept Supabase Profiles REST calls
    await page.route('**/rest/v1/profiles?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-uuid-12345',
          hobbies: ['Reading', 'Hiking', 'Gaming'],
          interests: ['Technology', 'Art', 'Music'],
          passions: ['Learning', 'Creativity'],
          work: ['Software Dev', 'Management']
        })
      });
    });

    // Intercept Supabase Tasks REST calls
    await page.route('**/rest/v1/tasks?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-task-1',
            title: 'Gym for 1hr',
            type: 'ADULT',
            status: 'TODO',
            scheduled_date: '2026-05-29',
            scheduled_time: '10:00',
            duration: 60,
            created_at: '2026-05-29T10:00:00.000Z'
          },
          {
            id: 'mock-task-2',
            title: 'Casual narrative-driven gaming session',
            type: 'CHILD',
            status: 'TODO',
            scheduled_date: '2026-05-29',
            scheduled_time: '10:30',
            duration: 30,
            created_at: '2026-05-29T10:30:00.000Z'
          }
        ])
      });
    });

    // Intercept other Supabase REST tables
    await page.route('**/rest/v1/goals?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/rest/v1/daily_history?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/rest/v1/ai_memory?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Inject state to localStorage so the frontend store is initialized
    const mockState = {
      state: {
        isAuthenticated: true,
        authError: null,
        tasks: [
          {
            id: 'mock-task-1',
            title: 'Gym for 1hr',
            type: 'ADULT',
            status: 'TODO',
            scheduledDate: '2026-05-29',
            scheduledTime: '10:00',
            duration: 60,
            createdAt: '2026-05-29T10:00:00.000Z'
          },
          {
            id: 'mock-task-2',
            title: 'Casual narrative-driven gaming session',
            type: 'CHILD',
            status: 'TODO',
            scheduledDate: '2026-05-29',
            scheduledTime: '10:30',
            duration: 30,
            createdAt: '2026-05-29T10:30:00.000Z'
          }
        ],
        history: [],
        goals: [],
        aiMemory: [],
        _hasHydrated: true,
        preferences: {
          hobbies: ['Reading', 'Hiking', 'Gaming'],
          interests: ['Technology', 'Art', 'Music'],
          passions: ['Learning', 'Creativity'],
          work: ['Software Dev', 'Management'],
          aiEnabled: true
        }
      },
      version: 0
    };

    // Prepare Supabase auth token
    const mockSupabaseAuth = {
      access_token: 'mock-access-token-jwt',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 360000,
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-uuid-12345',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'demo@example.com',
        email_confirmed_at: '2026-05-29T14:50:00Z',
        phone: '',
        confirmed_at: '2026-05-29T14:50:00Z',
        last_sign_in_at: '2026-05-29T14:50:00Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: '2026-05-29T14:50:00Z',
        updated_at: '2026-05-29T14:50:00Z'
      }
    };

    await page.addInitScript(({ state, supabaseState }) => {
      window.localStorage.setItem('mindsync-storage', JSON.stringify(state));
      window.localStorage.setItem('sb-cpxgmtvravfegdrjscbx-auth-token', JSON.stringify(supabaseState));
    }, { state: mockState, supabaseState: mockSupabaseAuth });
  });

  test('Desktop View - Center Date Label and Glassmorphic Button', async ({ page }) => {
    // Set desktop resolution
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Allow react hydration and CSS transitions to settle

    // Check if the center Date Label is visible on desktop
    const centerDateLabel = page.locator('h3.hidden.md\\:block');
    await expect(centerDateLabel).toBeVisible();

    // Check if the mobile inline Date Label is hidden
    const mobileDateLabel = page.locator('h3.md\\:hidden');
    await expect(mobileDateLabel).toBeHidden();

    // Take screenshot to verify layout balance
    await page.screenshot({ path: 'test-screenshot-desktop.png' });
    console.log('✅ Captured test-screenshot-desktop.png');
  });

  test('Tablet View - Center Date Label Visible', async ({ page }) => {
    // Set tablet resolution (iPad portrait)
    await page.setViewportSize({ width: 768, height: 1024 });

    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // At 768px wide (md breakpoint), the center Date Label should be visible
    const centerDateLabel = page.locator('h3.hidden.md\\:block');
    await expect(centerDateLabel).toBeVisible();

    // The mobile label should be hidden
    const mobileDateLabel = page.locator('h3.md\\:hidden');
    await expect(mobileDateLabel).toBeHidden();

    // Take screenshot
    await page.screenshot({ path: 'test-screenshot-tablet.png' });
    console.log('✅ Captured test-screenshot-tablet.png');
  });

  test('Mobile View - Center Date Label Hidden, Left Inline Label Visible', async ({ page }) => {
    // Set mobile resolution (iPhone 12 Pro)
    await page.setViewportSize({ width: 390, height: 844 });

    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // At 390px (below md breakpoint), the center Date Label should be hidden
    const centerDateLabel = page.locator('h3.hidden.md\\:block');
    await expect(centerDateLabel).toBeHidden();

    // The mobile inline date label should be visible
    const mobileDateLabel = page.locator('h3.md\\:hidden');
    await expect(mobileDateLabel).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-screenshot-mobile.png' });
    console.log('✅ Captured test-screenshot-mobile.png');
  });
});
