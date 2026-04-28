import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'evan@commerciallendingx.com';
const TEST_PASSWORD = 'BaileyDoo916!';

test('diagnose auth and settings page', async ({ page }) => {
  console.log('\n🔍 DIAGNOSTIC TEST: Auth & Settings Page\n');

  // Go to auth
  console.log('1️⃣  Going to /auth...');
  await page.goto('http://localhost:8084/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Check what we see
  const authPageContent = await page.locator('body').textContent();
  const hasEmailInput = authPageContent?.includes('email') || authPageContent?.includes('Email');
  const hasLoginButton = authPageContent?.includes('Sign') || authPageContent?.includes('Login');

  console.log(`   - Has email field: ${hasEmailInput ? '✅' : '❌'}`);
  console.log(`   - Has login button: ${hasLoginButton ? '✅' : '❌'}`);

  // Try to fill and submit
  console.log('\n2️⃣  Attempting login...');
  try {
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const button = page.locator('button').filter({ hasText: /sign|login/i }).first();

    await emailInput.fill(TEST_EMAIL);
    console.log('   - Filled email ✅');

    await passwordInput.fill(TEST_PASSWORD);
    console.log('   - Filled password ✅');

    await button.click();
    console.log('   - Clicked login button ✅');

    // Wait a bit
    await page.waitForTimeout(2000);

    const postLoginUrl = page.url();
    console.log(`   - URL after login: ${postLoginUrl}`);

    if (postLoginUrl.includes('/auth')) {
      const errorMsg = await page.locator('[role="alert"], .error, [class*="error"]').first().textContent().catch(() => null);
      if (errorMsg) {
        console.log(`   - Error shown: ${errorMsg}`);
      }
    }
  } catch (e) {
    console.log(`   - Error: ${e}`);
  }

  // Try direct navigation to settings
  console.log('\n3️⃣  Navigating to settings directly...');
  await page.goto('http://localhost:8084/admin/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const settingsUrl = page.url();
  const settingsContent = await page.textContent('body');

  console.log(`   - Final URL: ${settingsUrl}`);
  console.log(`   - Has content: ${settingsContent && settingsContent.length > 100 ? '✅' : '❌'}`);
  console.log(`   - First 150 chars: ${settingsContent?.substring(0, 150)}...`);

  // Take screenshot
  await page.screenshot({ path: 'diagnostic-screenshot.png', fullPage: true });
  console.log('   - Screenshot saved: diagnostic-screenshot.png\n');
});
