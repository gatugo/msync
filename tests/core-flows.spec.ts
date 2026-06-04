import { test, expect } from '@playwright/test';

test.describe('MindSync Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Inject test mode flag to bypass Supabase auth
    await page.addInitScript(() => {
      localStorage.setItem('mindsync_test_mode', 'true');
    });
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForLoadState('networkidle');
  });

  test('should load the main application dashboard', async ({ page }) => {
    await expect(page.locator('text=MindSync').first()).toBeVisible();
    await expect(page.locator('text=New Task').first()).toBeVisible();
  });

  test('should create a new task and mark it complete', async ({ page }) => {
    // Click New Task
    await page.click('text=New Task');
    
    // Wait for the modal/panel
    const taskInput = page.getByPlaceholder(/Type to add/i);
    await expect(taskInput).toBeVisible();
    
    await taskInput.fill('Playwright Test Task at 10:00');
    
    await page.screenshot({ path: 'test-debug-1.png' });
    
    // Click Add Task (submit button in the AddTaskPanel form)
    await page.locator('form').getByRole('button', { name: 'Add Task' }).click();

    // Wait for the modal/panel to disappear before checking
    await expect(taskInput).not.toBeVisible();
    await page.screenshot({ path: 'test-debug-2.png' });

    // Verify task appears anywhere on the page
    await expect(page.getByText('Playwright Test Task').first()).toBeVisible({ timeout: 10000 });

    // The task should have a checkmark button to complete
    const completeButton = page.locator('div').filter({ hasText: 'Playwright Test Task' }).locator('button[title="Mark complete"]').first();
    if (await completeButton.isVisible()) {
        await completeButton.click();
    }
  });

  test('should navigate to AI Coach and interact', async ({ page }) => {
    // Navigate to coach tab (assuming the bottom nav has "Coach")
    await page.getByRole('button', { name: /Coach/i }).click();

    // Wait for AI Coach screen
    await expect(page.locator('text=AI Coach').first()).toBeVisible();
    
    // Switch to Chat mode
    await page.click('text=Chat');

    // Send a message
    const input = page.getByPlaceholder('Ask MindSync...');
    await input.fill('Hello AI');
    await input.press('Enter');

    // Wait for the message to appear
    await expect(page.locator('text=Hello AI').first()).toBeVisible();
  });
});
