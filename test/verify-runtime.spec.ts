import { test, expect } from '@playwright/test';

test.describe('MindSync runtime verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('app loads at / without console errors and MindSync is visible', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[console error] ${msg.text()}`);
    });
    page.on('pageerror', err => consoleErrors.push(`[page error] ${err.message}`));

    await expect(page.getByText(/MindSync/i).first()).toBeVisible({ timeout: 15000 });
    expect(consoleErrors).toEqual([]);
  });

  test('AI Coach tab/screen is reachable', async ({ page }) => {
    const coachTab = page.getByRole('button', { name: /Coach/i }).first();
    await expect(coachTab).toBeVisible({ timeout: 10000 });
    await coachTab.click();
    await page.waitForTimeout(1000);
    const visible = await page.getByText(/AI Coach|Coach|Ask MindSync|Ask your coach/i).first().isVisible().catch(() => false);
    expect(visible).toBe(true);
  });

  test('settings includes StepFun config fields and app loads without supabase credential warnings', async ({ page }) => {
    const settingsTab = page.getByRole('button', { name: /Settings/i }).first();
    if (await settingsTab.isVisible().catch(() => false)) {
      await settingsTab.click();
      await page.waitForTimeout(500);
    }

    const warnings: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'warning' && /supabase|credential|anon key|SUPABASE/i.test(text)) {
        warnings.push(`[warning] ${text}`);
      }
    });

    const hasStepFun = await page.getByText(/StepFun|stepfun/i).first().isVisible().catch(() => false);
    expect(hasStepFun).toBe(true);
    expect(warnings).toEqual([]);
  });

  test('explicit-date scheduling text creates task with expected fields and persists in localStorage', async ({ page }) => {
    const newTaskBtn = page.getByRole('button', { name: /New Task/i }).first();
    await expect(newTaskBtn).toBeVisible({ timeout: 10000 });
    await newTaskBtn.click();

    const input = page.getByPlaceholder(/Type to add/i).first();
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.fill('Schedule morning meeting on 2026-09-09 at 9am for 1 hour');

    await page.locator('form').getByRole('button', { name: /Add Task/i }).click();

    await expect(input).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const storage = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('mindsync-storage');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    });

    const state = storage && typeof storage === 'object' ? storage : (storage && storage.state ? storage.state : null);
    const tasks = (state && state.tasks) || [];
    const task = tasks.find((t: any) => /morning meeting/i.test(t.title || ''));
    expect(!!task).toBe(true);
    expect(task.scheduledDate).toBe('2026-09-09');
    expect(task.scheduledTime).toBe('09:00');
    expect(task.duration).toBe(60);
  });
});
