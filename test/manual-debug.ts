import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const out: string[] = [];

  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(500);

  const goalTitle = 'Launch website';
  const today = new Date().toISOString().slice(0, 10);

  await page.getByRole('button', { name: 'Goals' }).click();
  await page.waitForTimeout(500);
  out.push('opened goals');

  await page.getByRole('button', { name: 'Set New Target' }).click();
  await page.waitForTimeout(300);
  out.push('opened add-goal form');

  const input = page.getByPlaceholder('What is your goal?').first();
  out.push('input visible=' + (await input.count()));
  out.push('input visible2=' + (await input.isVisible()));
  await input.fill(goalTitle);
  out.push('filled goal title');

  const dateInputs = await page.locator('input[type="date"], input[placeholder*="Date" i], input[aria-label*="Date" i], input[id*="date" i]').all();
  out.push('date input count=' + dateInputs.length);
  for (const el of dateInputs) {
    out.push('date input tag=' + (await el.evaluate((n: any) => n.outerHTML.slice(0, 180))));
  }

  const buttons = await page.getByRole('button').all();
  const startButtons = buttons.filter(async (btn: any) => (await btn.textContent())?.includes('Start Journey'));
  out.push('start journey buttons=' + (await page.getByRole('button', { name: /Start Journey/i }).count()));

  if (await page.getByRole('button', { name: /Start Journey/i }).count()) {
    await page.getByRole('button', { name: /Start Journey/i }).first().click();
    out.push('submitted form');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: './test-results/manual-03-goal-created.png', fullPage: true });
  console.log(out.join('\n'));
  await browser.close();
})();
