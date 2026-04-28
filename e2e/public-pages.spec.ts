import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/how-it-works', name: 'How It Works' },
  { path: '/contact', name: 'Contact' },
  { path: '/transactions', name: 'Transactions' },
  { path: '/bank-services', name: 'Bank Services' },
  { path: '/solutions/business-acquisition', name: 'Business Acquisition' },
  { path: '/solutions/commercial-real-estate', name: 'Commercial Real Estate' },
  { path: '/solutions/working-capital', name: 'Working Capital' },
];

test('navigate through all public pages and verify rendering', async ({ page }) => {
  const results: Array<{
    path: string;
    name: string;
    status: string;
    loadTime: number;
    errors: string[];
  }> = [];

  for (const route of PUBLIC_ROUTES) {
    console.log(`\n🔄 Loading: ${route.name} (${route.path})`);

    const errors: string[] = [];
    const errorListener = (msg: any) => {
      if (msg.type?.() === 'error') {
        errors.push(msg.text?.());
      }
    };

    page.on('console', errorListener);

    try {
      const startTime = Date.now();
      await page.goto(`http://localhost:8084${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      const loadTime = Date.now() - startTime;

      // Check the page has content
      const title = await page.title();
      const heading = await page.locator('h1, h2, h3').first().textContent();
      const bodyText = await page.textContent('body');

      if (!bodyText || bodyText.length < 50) {
        results.push({
          path: route.path,
          name: route.name,
          status: '❌ FAILED - No content',
          loadTime,
          errors: ['Page appears empty'],
        });
        console.log(`   ❌ FAILED - No content`);
      } else if (
        bodyText.includes('404') ||
        bodyText.includes('Error') ||
        bodyText.includes('error')
      ) {
        results.push({
          path: route.path,
          name: route.name,
          status: '⚠️  WARNING - Contains error text',
          loadTime,
          errors,
        });
        console.log(`   ⚠️  WARNING - Contains error text`);
        console.log(`   Title: ${title}`);
        console.log(`   Heading: ${heading}`);
      } else {
        results.push({
          path: route.path,
          name: route.name,
          status: '✅ OK',
          loadTime,
          errors,
        });
        console.log(`   ✅ OK - Rendered in ${loadTime}ms`);
        console.log(`   Title: ${title}`);
        console.log(`   Heading: ${heading}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({
        path: route.path,
        name: route.name,
        status: '❌ TIMEOUT/FAILED',
        loadTime: 0,
        errors: [errorMsg],
      });
      console.log(`   ❌ TIMEOUT/FAILED - ${errorMsg}`);
    }

    page.removeListener('console', errorListener);
  }

  // Summary
  console.log('\n\n📊 SUMMARY:');
  console.log('=' + '='.repeat(79));

  const passed = results.filter((r) => r.status.includes('✅')).length;
  const warned = results.filter((r) => r.status.includes('⚠️')).length;
  const failed = results.filter((r) => r.status.includes('❌')).length;

  for (const result of results) {
    const icon = result.status.includes('✅')
      ? '✅'
      : result.status.includes('⚠️')
        ? '⚠️'
        : '❌';
    console.log(`${icon} ${result.name.padEnd(30)} ${result.loadTime}ms`);
  }

  console.log('=' + '='.repeat(79));
  console.log(`✅ Passed: ${passed}  ⚠️  Warned: ${warned}  ❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / PUBLIC_ROUTES.length) * 100).toFixed(0)}%\n`);

  expect(passed).toBeGreaterThanOrEqual(PUBLIC_ROUTES.length - 2); // Allow 2 failures
});
