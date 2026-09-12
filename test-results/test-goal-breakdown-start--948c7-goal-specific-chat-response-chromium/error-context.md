# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test\goal-breakdown-start.spec.ts >> Breakdown with AI opens Coach and shows real goal-specific chat response
- Location: test\goal-breakdown-start.spec.ts:40:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Launch website').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Launch website').first()

```

```yaml
- banner:
  - img
  - heading "MindSync" [level=1]
  - paragraph: Sync. Focus. Flow.
  - img
  - img "mood": 🤯
  - text: 50 /100 neutral
  - button "Hide"
  - button "New Task"
- main:
  - button
  - button
  - button
  - button
  - button "Today"
  - button
  - heading "Friday, September 11" [level=3]
  - button "Add Task"
  - text: 5 AM 5:30 AM 6 AM 6:30 AM 7 AM 7:30 AM 8 AM 8:30 AM 9 AM 9:30 AM 10 AM 10:30 AM 11 AM 11:30 AM 12 PM 12:30 PM 1 PM 1:30 PM 2 PM 2:30 PM 3 PM 3:30 PM 4 PM 4:30 PM 5 PM 5:30 PM 6 PM 6:30 PM 7 PM 7:30 PM 8 PM 8:30 PM 9 PM 9:30 PM 10 PM 10:30 PM 11 PM 11:30 PM 12 AM 12:30 AM
- button "Create New Task"
- navigation:
  - button "Home"
  - button "Coach"
  - button "Stats"
  - button "Settings"
- heading "Goals" [level=3]
- paragraph: 0 Active Targets
- button "Add new goal"
- button "Close Panel"
- textbox "What is your goal?" [disabled]
- button "Date"
- button "Time"
- button "Cancel"
- button "Start Journey" [disabled]
- img "No goals"
- heading "Your Horizon is Clear" [level=4]
- paragraph: Goals give the Adult brain direction and the Child brain purpose. What's your next peak?
- button "Set New Target"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  5  | const GOAL_TITLE = 'Launch website';
  6  | 
  7  | async function screenshot(page: any, name: string) {
  8  |   const file = path.join('test-results', `verify-${name}.png`);
  9  |   await page.screenshot({ path: file, fullPage: true });
  10 |   return file;
  11 | }
  12 | 
  13 | async function seedGoal(page: any) {
  14 |   const today = new Date().toISOString().slice(0, 10);
  15 |   await page.goto(BASE);
  16 |   await page.evaluate(({ title, date }) => {
  17 |     localStorage.setItem(
  18 |       'mindsync_goals',
  19 |       JSON.stringify([
  20 |         {
  21 |           id: 'goal-' + Date.now(),
  22 |           title,
  23 |           targetDate: date,
  24 |           startTime: '',
  25 |           completed: false,
  26 |           createdAt: new Date().toISOString(),
  27 |         },
  28 |       ])
  29 |     );
  30 |   }, { title: GOAL_TITLE, date: today });
  31 |   await page.reload();
  32 |   await page.waitForTimeout(500);
  33 | 
  34 |   await page.getByRole('button', { name: 'Goals' }).click();
  35 |   await page.waitForTimeout(500);
> 36 |   await expect(page.getByText(GOAL_TITLE).first()).toBeVisible();
     |                                                    ^ Error: expect(locator).toBeVisible() failed
  37 |   await screenshot(page, 'goal-created');
  38 | }
  39 | 
  40 | test('Breakdown with AI opens Coach and shows real goal-specific chat response', async ({ page }) => {
  41 |   await seedGoal(page);
  42 | 
  43 |   const breakdownBtn = page.getByTestId('breakdown-btn').first();
  44 |   await breakdownBtn.click();
  45 |   await page.waitForTimeout(1500);
  46 |   const response = await page.evaluate(() => document.body.innerText);
  47 |   await screenshot(page, 'breakdown-coach');
  48 | 
  49 |   expect(response, 'Coach response text is empty').not.toBe('');
  50 |   expect(response.toLowerCase(), 'Breakdown response did not mention goal name').toContain(GOAL_TITLE.toLowerCase());
  51 | });
  52 | 
  53 | test('Start/Play opens Coach and shows real goal-specific chat response', async ({ page }) => {
  54 |   await seedGoal(page);
  55 | 
  56 |   await page.getByLabel('Start goal').click();
  57 |   await page.waitForTimeout(1500);
  58 |   const response = await page.evaluate(() => document.body.innerText);
  59 |   await screenshot(page, 'start-coach');
  60 | 
  61 |   expect(response, 'Coach response text is empty').not.toBe('');
  62 |   expect(response.toLowerCase(), 'Start response did not mention goal name').toContain(GOAL_TITLE.toLowerCase());
  63 | });
  64 | 
```