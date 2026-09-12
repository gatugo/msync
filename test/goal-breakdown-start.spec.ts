import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const GOAL_TITLE = 'Launch website';

async function screenshot(page: any, name: string) {
  const file = path.join('test-results', `verify-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function seedGoal(page: any) {
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(BASE);
  await page.evaluate(({ title, date }) => {
    localStorage.setItem(
      'mindsync_goals',
      JSON.stringify([
        {
          id: 'goal-' + Date.now(),
          title,
          targetDate: date,
          startTime: '',
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ])
    );
  }, { title: GOAL_TITLE, date: today });
  await page.reload();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Goals' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(GOAL_TITLE).first()).toBeVisible();
  await screenshot(page, 'goal-created');
}

test('Breakdown with AI opens Coach and shows real goal-specific chat response', async ({ page }) => {
  await seedGoal(page);

  const breakdownBtn = page.getByTestId('breakdown-btn').first();
  await breakdownBtn.click();
  await page.waitForTimeout(1500);
  const response = await page.evaluate(() => document.body.innerText);
  await screenshot(page, 'breakdown-coach');

  expect(response, 'Coach response text is empty').not.toBe('');
  expect(response.toLowerCase(), 'Breakdown response did not mention goal name').toContain(GOAL_TITLE.toLowerCase());
});

test('Start/Play opens Coach and shows real goal-specific chat response', async ({ page }) => {
  await seedGoal(page);

  await page.getByLabel('Start goal').click();
  await page.waitForTimeout(1500);
  const response = await page.evaluate(() => document.body.innerText);
  await screenshot(page, 'start-coach');

  expect(response, 'Coach response text is empty').not.toBe('');
  expect(response.toLowerCase(), 'Start response did not mention goal name').toContain(GOAL_TITLE.toLowerCase());
});
