const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`CONSOLE: ${msg.text()}`);
  });

  const routes = [
    '/', '/sas', '/monitoring', '/billing', '/vouchers', '/alerts',
    '/tickets', '/add-device',
    '/invoices', '/map', '/plans', '/remote'
  ];

  let failures = 0;

  for (const route of routes) {
    await page.goto('http://localhost:3000' + route, { waitUntil: 'load', timeout: 15000 });

    // Count sidebar sections before click
    const before = await page.locator('.sidebar').count();
    const navSectionCountBefore = await page.locator('.sidebar .nav-section').count();
    const ulCountBefore = await page.locator('.sidebar .nav-section ul').count();

    // Click first non-active sidebar link (selector fixed: .nav-section ul li a)
    const links = page.locator('.sidebar .nav-section ul li a:not(.active)');
    const linkCount = await links.count();

    if (linkCount > 0) {
      await links.first().click();
      await page.waitForTimeout(800);
    }

    const after = await page.locator('.sidebar').count();
    const navSectionCountAfter = await page.locator('.sidebar .nav-section').count();
    const ulCountAfter = await page.locator('.sidebar .nav-section ul').count();

    const sidebarGrew = after > before;
    const navGrew = navSectionCountAfter > navSectionCountBefore;
    const ulGrew = ulCountAfter > ulCountBefore;

    console.log(
      `ROUTE ${route} | sidebars: ${before}->${after} | nav-sections: ${navSectionCountBefore}->${navSectionCountAfter} | uls: ${ulCountBefore}->${ulCountAfter} | ${sidebarGrew || navGrew || ulGrew ? 'GROWTH DETECTED' : 'stable'}`
    );

    if (sidebarGrew || navGrew || ulGrew) {
      failures++;
      console.log(`  BUG: sidebar sections increased on ${route}`);
    }
  }

  await browser.close();

  if (pageErrors.length) {
    console.log('PAGE_ERRORS:', pageErrors);
    failures++;
  }

  console.log(failures === 0 ? 'SIDEBAR_AUTOMATION_OK' : `SIDEBAR_AUTOMATION_FAIL ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
