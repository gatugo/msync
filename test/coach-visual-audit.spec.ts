import { test, expect } from '@playwright/test';

test.describe('AI Coach Mobile UX Redesign Visual Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth GET User calls
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

    // Mock Supabase REST Profiles
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

    // Mock Supabase REST Tasks
    await page.route('**/rest/v1/tasks?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mock-task-1',
            title: 'Hiking 30min',
            type: 'CHILD',
            status: 'TODO',
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: '13:30',
            duration: 30,
            created_at: new Date().toISOString()
          }
        ])
      });
    });

    // Mock Supabase REST Goals
    await page.route('**/rest/v1/goals?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock Supabase REST daily history
    await page.route('**/rest/v1/daily_history?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock Supabase REST ai_memory
    await page.route('**/rest/v1/ai_memory?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Setup mock frontend state
    const mockState = {
      state: {
        isAuthenticated: true,
        authError: null,
        tasks: [
          {
            id: 'mock-task-1',
            title: 'Hiking 30min',
            type: 'CHILD',
            status: 'TODO',
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: '13:30',
            duration: 30,
            createdAt: new Date().toISOString()
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
      window.localStorage.setItem('mindsync_test_mode', 'true');
      window.localStorage.setItem('mindsync-storage', JSON.stringify(state));
      window.localStorage.setItem('sb-cpxgmtvravfegdrjscbx-auth-token', JSON.stringify(supabaseState));
    }, { state: mockState, supabaseState: mockSupabaseAuth });
  });

  test('Capture Mobile AI Coach View screenshots', async ({ page }) => {
    // Set mobile resolution (iPhone 14 Pro screen)
    await page.setViewportSize({ width: 390, height: 844 });

    // Navigate to local dev server
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click the bottom navigation "Coach" button to open AI Coach Screen
    const coachNavButton = page.getByRole('button', { name: /Coach/i });
    await expect(coachNavButton).toBeVisible();
    await coachNavButton.click();

    // Verify AI Coach modal/panel opens up by verifying the close icon is present
    const closeButton = page.locator('button[title="Exit Coach"]').first();
    await expect(closeButton).toBeVisible();
    await page.waitForTimeout(1000);

    // Verify the mobile dropdown trigger title is visible and can be clicked
    const dropdownButton = page.locator('button:has-text("Advice"), button:has-text("Chat"), button:has-text("AI Coach")').first();
    await expect(dropdownButton).toBeVisible();

    // Screenshot 1: Edge-to-Edge Initial View in Mobile Mode (should show Advice tab by default)
    await page.screenshot({ path: 'C:/Users/Rex/.gemini/antigravity/brain/a30aaaf3-cda7-4b00-a5c8-5edc3a3e5276/visual_audit_1_mobile_initial.png' });
    console.log('✅ Captured visual_audit_1_mobile_initial.png');

    // Click the interactive header title dropdown button
    await dropdownButton.click();
    await page.waitForTimeout(500);

    // Screenshot 2: Opened Interactive glassmorphic dropdown portal overlay
    await page.screenshot({ path: 'C:/Users/Rex/.gemini/antigravity/brain/a30aaaf3-cda7-4b00-a5c8-5edc3a3e5276/visual_audit_2_mobile_dropdown.png' });
    console.log('✅ Captured visual_audit_2_mobile_dropdown.png');

    // Click the Chat option inside the dropdown menu (using exact button role/text or list text)
    const chatOption = page.locator('button:has-text("Chat")').first();
    await chatOption.click();
    await page.waitForTimeout(500);

    // Switch to Chat conversation mode, type and send a mock message
    const input = page.getByPlaceholder('Ask MindSync...');
    await expect(input).toBeVisible();
    await input.fill('Suggest some hiking options');
    await input.press('Enter');

    // Wait for response or typing state to show
    await page.waitForTimeout(2000);

    // Screenshot 3: Active Conversational thread on mobile
    await page.screenshot({ path: 'C:/Users/Rex/.gemini/antigravity/brain/a30aaaf3-cda7-4b00-a5c8-5edc3a3e5276/visual_audit_3_mobile_chat.png' });
    console.log('✅ Captured visual_audit_3_mobile_chat.png');
  });
});
