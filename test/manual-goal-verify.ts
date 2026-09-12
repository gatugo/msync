import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const out = [];

  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(500);
  await page.screenshot({ path: './test-results/manual-01-home.png', fullPage: true });
  out.push('home screenshot saved');

  const openGoals = async () => {
    const btn = page.getByRole('button', { name: 'Goals' });
    out.push('Goals button visible=' + (await btn.count()));
    if ((await btn.count()) > 0) {
      await btn.first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: './test-results/manual-02-goals.png', fullPage: true });
    out.push('goals screenshot saved');
  };

  await openGoals();

  const selectors = [
    'input[placeholder="What is your goal?"]',
    'input[type="text"]',
    'button:has-text("Start Journey")',
    'button:has-text("Add new goal")',
    '[data-testid="breakdown-btn"]',
  ];
  for (const sel of selectors) {
    out.push(sel + ' => ' + (await page.locator(sel).count()));
  }

  if (await page.locator('input[placeholder="What is your goal?"]').count()) {
    await page.locator('input[placeholder="What is your goal?"]').fill('Launch website');
    await page.getByLabel('Date').fill(new Date().toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Start Journey' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: './test-results/manual-03-goal-created.png', fullPage: true });
    out.push('created goal');
  }

  if (await page.locator('[data-testid="breakdown-btn"]').count()) {
    await page.getByTestId('breakdown-btn').click();
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: './test-results/manual-04-breakdown-coach.png', fullPage: true });
    out.push('breakdown screenshot saved');
    out.push('breakdown text length=' + text.length);
    out.push('breakdown has goal=' + text.toLowerCase().includes('launch website'));
  }

  if (await page.locator('button:has-text("Start goal")').count()) {
    await page.getByLabel('Start goal').click();
    await page.waitForTimeout(1200);
    const text2 = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: './test-results/manual-05-start-coach.png', fullPage: true });
    out.push('start screenshot saved');
    out.push('start text length=' + text2.length);
    out.push('start has goal=' + text2.toLowerCase().includes('launch website'));
  }

  fs.writeFileSync('./test-results/manual-goal-verify-result.txt', out.join('\n'));
  console.log(out.join('\n'));
  await browser.close();
})();
