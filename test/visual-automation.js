const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const routes = [
  { name: 'dashboard', path: '/' },
  { name: 'sas', path: '/sas' },
  { name: 'monitoring', path: '/monitoring' },
  { name: 'billing', path: '/billing' },
  { name: 'vouchers', path: '/vouchers' },
  { name: 'alerts', path: '/alerts' },
  { name: 'tickets', path: '/tickets' },
  { name: 'add-device', path: '/add-device' },
  { name: 'invoices', path: '/invoices' },
  { name: 'map', path: '/map' },
  { name: 'plans', path: '/plans' },
  { name: 'remote', path: '/remote' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const pageErrors = [];
  const failedResources = [];
  page.on('pageerror', (e) => pageErrors.push(`PAGE_ERROR on ${page.url()}: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`CONSOLE_ERROR on ${page.url()}: ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    failedResources.push(`FAILED_RESOURCE on ${page.url()}: ${req.url()} (${req.failure()?.errorText || 'unknown'})`);
  });

  const results = [];

  for (const route of routes) {
    const pageIssues = [];
    await page.goto('http://localhost:3000' + route.path, { waitUntil: 'load', timeout: 15000 });

    // Capture full-page screenshot
    const screenshotPath = path.join(screenshotsDir, `${route.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Check for content overflow (elements wider than viewport)
    const overflowWidth = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      return docWidth > viewportWidth ? docWidth - viewportWidth : 0;
    });
    if (overflowWidth > 0) {
      pageIssues.push(`CONTENT_OVERFLOW: ${overflowWidth}px wider than viewport`);
    }

    // Check for missing/broken images
    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src || img.srcset);
    });
    if (brokenImages.length > 0) {
      pageIssues.push(`BROKEN_IMAGES: ${brokenImages.join(', ')}`);
    }

    // Collect errors accumulated for this page (since last route)
    // We'll just report all at end

    results.push({
      route: route.path,
      name: route.name,
      screenshot: screenshotPath,
      issues: pageIssues,
    });

    console.log(`SCREENSHOT ${route.name} -> ${route.name}.png (${pageIssues.length} issues)`);
  }

  await browser.close();

  // Write report
  const report = {
    generated: new Date().toISOString(),
    totalRoutes: routes.length,
    totalIssues: pageErrors.length + failedResources.length + results.reduce((sum, r) => sum + r.issues.length, 0),
    pageErrors,
    failedResources,
    results,
  };
  fs.writeFileSync(path.join(screenshotsDir, 'report.json'), JSON.stringify(report, null, 2));

  const totalIssues = report.totalIssues;
  console.log(`\nVISUAL_AUTOMATION: ${routes.length} routes screenshotted to ${screenshotsDir}/`);
  console.log(`Total issues detected: ${totalIssues}`);
  if (pageErrors.length) console.log('Page/Console errors:', pageErrors);
  if (failedResources.length) console.log('Failed resources:', failedResources);
  results.forEach((r) => {
    if (r.issues.length) console.log(`  ${r.name}: ${r.issues.join('; ')}`);
  });

  process.exit(totalIssues === 0 ? 0 : 1);
})();
