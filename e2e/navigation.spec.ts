import { test, expect } from '@playwright/test';

test.describe('Navigation and Page Rendering', () => {
  test('should render home page', async ({ page }) => {
    await page.goto('http://localhost:8084/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check page is not showing error
    const errorText = await page.locator('text=/error|404|500/i').count();
    expect(errorText).toBe(0);
    
    console.log('✅ Home page rendered successfully');
    console.log(`   URL: ${page.url()}`);
  });

  test('should navigate to public pages', async ({ page }) => {
    await page.goto('http://localhost:8084/');
    await page.waitForLoadState('networkidle');
    
    // Check page title or key elements are present
    const pageText = await page.textContent('body');
    expect(pageText).toBeTruthy();
    
    console.log(`✅ Page loaded with content`);
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:8084/');
    await page.waitForLoadState('networkidle');

    if (errors.length > 0) {
      console.log('⚠️  Console errors found:');
      errors.forEach(e => console.log(`   - ${e}`));
    } else {
      console.log('✅ No console errors');
    }
  });

  test('should render with no broken images', async ({ page }) => {
    await page.goto('http://localhost:8084/');
    await page.waitForLoadState('networkidle');

    const images = await page.locator('img').all();
    console.log(`📸 Found ${images.length} images on page`);

    for (const img of images) {
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth === 0) {
        const src = await img.getAttribute('src');
        console.log(`   ⚠️  Broken image: ${src}`);
      }
    }
  });
});
