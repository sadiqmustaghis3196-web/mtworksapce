const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login');
  
  await page.fill('input[type="email"]', 'test_user_regression@test.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button:has-text("Sign In")');

  console.log('Waiting for dashboard...');
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(2000); // Wait for sidebar to render fully

  const screenshotPath = path.join(__dirname, 'sidebar_screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to ' + screenshotPath);

  await browser.close();
})();
