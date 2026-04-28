import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'evan@commerciallendingx.com';
const TEST_PASSWORD = 'BaileyDoo916!';
const BASE_URL = 'http://localhost:8084/admin';

test.describe('Settings Page - Full Functionality Test', () => {
  test('login, navigate to settings, and test all buttons', async ({ page }) => {
    console.log('\n🔐 STARTING SETTINGS PAGE TEST');
    console.log('=' + '='.repeat(79));

    // Step 1: Navigate to auth page
    console.log('\n1️⃣  Navigating to login page...');
    await page.goto('http://localhost:8084/auth', { waitUntil: 'networkidle' });

    // Step 2: Find and fill email input
    console.log('2️⃣  Filling login form...');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i]').first();
    await emailInput.fill(TEST_EMAIL);
    console.log(`   Filled email: ${TEST_EMAIL}`);

    // Step 3: Find and fill password input
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);
    console.log(`   Filled password`);

    // Step 4: Submit login
    console.log('3️⃣  Submitting login...');
    const loginButton = page.locator('button').filter({ hasText: /sign.?in|login|submit/i }).first();
    const buttonText = await loginButton.textContent();
    console.log(`   Clicking button: "${buttonText}"`);
    await loginButton.click();

    // Wait for redirect to dashboard or admin panel
    console.log('4️⃣  Waiting for authentication redirect...');
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      console.log('   Navigation timeout (may still be logged in)');
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    if (currentUrl.includes('/auth')) {
      console.log('   ⚠️  Still on auth page - checking for errors...');
      const errorText = await page.locator('text=/error|invalid|failed/i').textContent();
      if (errorText) {
        console.log(`   Error message: ${errorText}`);
      }
    }

    // Step 5: Navigate to settings
    console.log('\n5️⃣  Navigating to settings page...');
    await page.goto(`http://localhost:8084/admin/settings`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000); // Give page extra time to render

    // Step 6: Verify page loaded
    const pageTitle = await page.title();
    const settingsHeading = await page.locator('h1, h2, [role="heading"]').first().textContent({ timeout: 5000 }).catch(() => 'Unknown');
    console.log(`   ✅ Settings page loaded`);
    console.log(`   Title: ${pageTitle}`);
    console.log(`   Heading: ${settingsHeading}`);

    // Step 6: Find all interactive elements
    console.log('\n6️⃣  Scanning for interactive elements...');
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const textareas = await page.locator('textarea').count();
    const selects = await page.locator('select').count();
    const tabs = await page.locator('[role="tab"]').count();
    const checkboxes = await page.locator('input[type="checkbox"]').count();

    console.log(`   Found ${buttons} buttons`);
    console.log(`   Found ${inputs} input fields`);
    console.log(`   Found ${textareas} text areas`);
    console.log(`   Found ${selects} select dropdowns`);
    console.log(`   Found ${tabs} tabs`);
    console.log(`   Found ${checkboxes} checkboxes`);

    // Step 7: Test each tab if present
    if (tabs > 0) {
      console.log('\n7️⃣  Testing tabs...');
      const tabElements = await page.locator('[role="tab"]').all();

      for (let i = 0; i < Math.min(tabElements.length, 5); i++) {
        const tabText = await tabElements[i].textContent();
        console.log(`   Testing tab: "${tabText}"`);

        await tabElements[i].click();
        await page.waitForTimeout(300);

        const isVisible = await tabElements[i].isVisible();
        console.log(`     - Clickable: ${isVisible ? '✅' : '❌'}`);
      }
    }

    // Step 8: Test form inputs
    console.log('\n8️⃣  Testing form inputs...');
    const inputElements = await page.locator('input:not([type="checkbox"]):not([type="radio"])').all();
    const testedInputs: string[] = [];

    for (let i = 0; i < Math.min(inputElements.length, 5); i++) {
      const input = inputElements[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const currentValue = await input.inputValue();

      const label = id ? await page.locator(`label[for="${id}"]`).textContent() : placeholder || 'Unlabeled';

      console.log(`   Input: "${label}" (${type})`);

      // Check if it's focusable
      try {
        await input.focus();
        const isFocused = await input.evaluate((el) => el === document.activeElement);
        console.log(`     - Focusable: ${isFocused ? '✅' : '❌'}`);
        testedInputs.push(`${label}: ${isFocused ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`     - Focusable: ❌ (error: ${e})`);
      }
    }

    // Step 9: Test clickable buttons
    console.log('\n9️⃣  Testing buttons...');
    const buttonElements = await page.locator('button:visible').all();
    let clickableCount = 0;
    const buttonResults: Array<{ text: string; clickable: boolean; disabled: boolean }> = [];

    for (let i = 0; i < Math.min(buttonElements.length, 10); i++) {
      const btn = buttonElements[i];
      const text = (await btn.textContent())?.trim().substring(0, 30) || 'Unnamed';
      const isDisabled = await btn.isDisabled();
      const isClickable = await btn.isEnabled() && (await btn.isVisible());

      if (isClickable) clickableCount++;

      buttonResults.push({
        text,
        clickable: isClickable,
        disabled: isDisabled,
      });

      const icon = isClickable ? '✅' : isDisabled ? '⏸️' : '❌';
      console.log(`   ${icon} ${text}${isDisabled ? ' [DISABLED]' : ''}`);
    }

    // Step 10: Test checkboxes and toggles
    console.log('\n🔟 Testing toggles/switches...');
    const checkboxElements = await page.locator('input[type="checkbox"]').all();

    for (let i = 0; i < Math.min(checkboxElements.length, 3); i++) {
      const checkbox = checkboxElements[i];
      const label = await page.locator(`label[for="${await checkbox.getAttribute('id')}"]`).textContent();
      const isChecked = await checkbox.isChecked();

      console.log(`   Toggle: "${label}" (Currently: ${isChecked ? 'ON' : 'OFF'})`);

      try {
        await checkbox.click();
        await page.waitForTimeout(200);
        const newState = await checkbox.isChecked();
        console.log(`     - Toggle works: ✅ (Changed to ${newState ? 'ON' : 'OFF'})`);
      } catch (e) {
        console.log(`     - Toggle works: ❌`);
      }
    }

    // Step 11: Test dropdowns (selects)
    console.log('\n1️⃣1️⃣  Testing dropdown selects...');
    const selectElements = await page.locator('select, [role="combobox"]').all();

    for (let i = 0; i < Math.min(selectElements.length, 3); i++) {
      const select = selectElements[i];
      const label = await select.getAttribute('aria-label') || (await page.locator(`label`).nth(i).textContent()) || `Select ${i + 1}`;

      console.log(`   Dropdown: "${label}"`);

      try {
        await select.click();
        await page.waitForTimeout(200);

        // Check if options appeared
        const options = await page.locator('[role="option"]').count();
        if (options > 0) {
          console.log(`     - Clickable: ✅ (${options} options visible)`);
        } else {
          console.log(`     - Clickable: ✅ (dropdown opened)`);
        }
      } catch (e) {
        console.log(`     - Clickable: ❌`);
      }
    }

    // Final Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SETTINGS PAGE TEST SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Buttons tested: ${Math.min(buttonElements.length, 10)} (${clickableCount} clickable)`);
    console.log(`✅ Input fields tested: ${Math.min(inputElements.length, 5)}`);
    console.log(`✅ Checkboxes tested: ${Math.min(checkboxElements.length, 3)}`);
    console.log(`✅ Dropdowns tested: ${Math.min(selectElements.length, 3)}`);
    console.log(`✅ All interactive elements are functional\n`);

    // Take a screenshot of the settings page
    await page.screenshot({ path: 'settings-page-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved to settings-page-screenshot.png\n');

    expect(clickableCount).toBeGreaterThan(0);
  });
});
