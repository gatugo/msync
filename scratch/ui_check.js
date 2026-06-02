const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        console.log('Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000); 
        
        // If we are on login page, try to find "Back to Guest Mode"
        const guestLink = page.locator('text="Back to Guest Mode"');
        if (await guestLink.isVisible()) {
            console.log('Found Guest Mode link, clicking...');
            await guestLink.click();
            await page.waitForTimeout(5000);
        }

        await page.screenshot({ path: 'screenshot_home.png', fullPage: true });
        console.log('Saved screenshot_home.png');
        
        const coachButton = page.locator('button:has-text("Coach")');
        if (await coachButton.isVisible()) {
            await coachButton.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'screenshot_coach.png', fullPage: true });
            console.log('Saved screenshot_coach.png');
        } else {
            console.log('Coach button not found');
            // Try to see what buttons ARE there
            const buttons = await page.locator('button').allTextContents();
            console.log('Available buttons:', buttons);
        }
        
    } catch (e) {
        console.error('Error during browser test:', e);
    } finally {
        await browser.close();
    }
})();
