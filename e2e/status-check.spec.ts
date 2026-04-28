import { test, expect } from '@playwright/test';

test.describe('App Status Check', () => {
  test('check page rendering and what error exists', async ({ page }) => {
    // Disable request logging noise
    page.on('response', () => {});
    
    await page.goto('http://localhost:8084/', { waitUntil: 'networkidle' });
    
    // Get current URL
    const url = page.url();
    console.log(`\n📍 Current URL: ${url}`);
    
    // Get page title
    const title = await page.title();
    console.log(`📄 Page Title: ${title}`);
    
    // Get page heading
    const h1 = await page.locator('h1').first().textContent();
    console.log(`🏷️  Main Heading: ${h1}`);
    
    // Check for auth redirects
    if (url.includes('/auth') || url.includes('/login')) {
      console.log('🔐 Page redirected to auth - app requires login');
    }
    
    // Get all text to see what's displayed
    const allText = await page.textContent('body');
    const shortText = allText?.substring(0, 200).trim() || '';
    console.log(`📝 Page content (first 200 chars): ${shortText}...`);
    
    // Check for specific error patterns
    const has404 = allText?.includes('404');
    const has500 = allText?.includes('500');
    const hasError = allText?.includes('Error');
    const hasNotFound = allText?.includes('not found');
    
    console.log('\n🔍 Error patterns check:');
    console.log(`   - Contains "404": ${has404 ? '❌ YES' : '✅ no'}`);
    console.log(`   - Contains "500": ${has500 ? '❌ YES' : '✅ no'}`);
    console.log(`   - Contains "Error": ${hasError ? '⚠️  maybe' : '✅ no'}`);
    console.log(`   - Contains "not found": ${hasNotFound ? '⚠️  maybe' : '✅ no'}`);
    
    // Check if we can interact with page (buttons, inputs, etc)
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const links = await page.locator('a').count();
    
    console.log('\n🎯 Interactive elements:');
    console.log(`   - Buttons: ${buttons}`);
    console.log(`   - Input fields: ${inputs}`);
    console.log(`   - Links: ${links}`);
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
        loadComplete: nav.loadEventEnd - nav.loadEventStart,
      };
    });
    
    console.log('\n⚡ Performance:');
    console.log(`   - DOM Content Loaded: ${metrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`   - Page Load Complete: ${metrics.loadComplete.toFixed(0)}ms`);
  });
});
