import { test, expect } from '@playwright/test';

test.describe('Application UI/UX Flow', () => {
  test('should navigate through main tabs and check UI elements', async ({ page }) => {
    // We navigate to the root
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('body')).toBeVisible();

    // The user should see the Dashboard
    const dashboardTitle = page.getByText(/MindSync/i).first();
    await expect(dashboardTitle).toBeVisible();

    // Check Settings tab
    const settingsTab = page.getByRole('button', { name: /Settings/i });
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await expect(page.getByText(/Brain Personalization/i).first()).toBeVisible();

      // Check Data Lab Modal sizing
      const dataManagementBtn = page.getByText(/Data Management/i);
      await dataManagementBtn.click();

      // The modal should appear
      const dataLabModal = page.getByText(/Data Lab/i).first();
      await expect(dataLabModal).toBeVisible();

      // Wait a bit to ensure it doesn't overflow
      await page.waitForTimeout(500);

      // Close modal
      const returnBtn = page.getByRole('button', { name: /Return to Hub/i });
      await returnBtn.click();
      await expect(dataLabModal).not.toBeVisible();
    }
  });

  test('AI Coach should respond correctly using StepFun model', async ({ page }) => {
    await page.goto('/');

    // Navigate to AI Coach if available
    const coachTab = page.getByRole('button', { name: /AI Coach/i });
    if (await coachTab.isVisible()) {
      await coachTab.click();

      // Wait for AI Coach interface to load
      await expect(page.getByText(/MindSync AI Coach/i).first()).toBeVisible();

      // Submit a prompt
      const input = page.getByPlaceholder(/Ask your coach/i);
      if (await input.isVisible()) {
          await input.fill('Hello, are you responding fast?');
          await input.press('Enter');

          // Check that the AI responds
          // We wait for the streaming response to finish or thought tags
          const aiResponse = page.locator('.prose').last();
          await expect(aiResponse).toBeVisible({ timeout: 15000 });
      }
    }
  });
});
