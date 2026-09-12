import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const outDir = path.resolve('manual-verify-artifacts');
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('http://127.0.0.1:3000');
  await page.waitForTimeout(500);

  // Step 1: open Goals
  await page.getByRole('button', { name: 'Goals' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '01-goals-panel.png'), fullPage: true });

  // Open add-goal form
  await page.getByRole('button', { name: 'Set New Target' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '02-add-goal-form.png'), fullPage: true });

  // Fill form
  await page.getByPlaceholder('What is your goal?').fill('Launch website');
  
  // Open date picker and select today via the footer Today button
  await page.getByRole('button', { name: 'Date' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Today' }).nth(1).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '03-add-goal-filled.png'), fullPage: true });

  await page.getByRole('button', { name: 'Start Journey' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '04-goal-created.png'), fullPage: true });

  // Verify goal appears
  const goalVisible = await page.getByText('Launch website').first().isVisible().catch(() => false);
  fs.writeFileSync(path.join(outDir, 'result.txt'), `goal_visible=${goalVisible}\n`);

  // Step 2: Breakdown
  if (goalVisible) {
    await page.getByTestId('breakdown-btn').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '05-breakdown-coach.png'), fullPage: true });
    const breakdownText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(outDir, 'breakdown.txt'), breakdownText);
    fs.appendFileSync(path.join(outDir, 'result.txt'), `\nbreakdown_text_len=${breakdownText.length}\nbreakdown_mentions_goal=${breakdownText.toLowerCase().includes('launch website')}\n`);
  }

  // Step 3: Start
  if (goalVisible) {
    await page.getByLabel('Start goal').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '06-start-coach.png'), fullPage: true });
    const startText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(outDir, 'start.txt'), startText);
    fs.appendFileSync(path.join(outDir, 'result.txt'), `\nstart_text_len=${startText.length}\nstart_mentions_goal=${startText.toLowerCase().includes('launch website')}\n`);
  }

  console.log('Artifacts saved to', outDir);
  await browser.close();
})();
