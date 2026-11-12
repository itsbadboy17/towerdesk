const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const routes = [
    ['/', 'Home'],
    ['/subscribers', 'Subscribers'],
    ['/plans', 'Plans'],
    ['/monitoring', 'Monitoring'],
    ['/billing', 'Billing'],
    ['/vouchers', 'Vouchers'],
    ['/alerts', 'Alerts'],
    ['/remote', 'Remote'],
    ['/invoices', 'Invoices'],
    ['/map', 'Map'],
    ['/tickets', 'Tickets'],
    ['/add-device', 'Add Device'],
  ];

  let failures = 0;
  for (const [route] of routes) {
    const resp = await page.goto('http://localhost:3000' + route, { waitUntil: 'load', timeout: 15000 }).catch(() => null);
    const status = resp ? resp.status() : -1;
    let h1 = '';
    if (status === 200) {
      h1 = (await page.evaluate(() => (document.querySelector('h1') || {}).textContent || '')) || '';
    }
    console.log(`ROUTE ${route} -> ${status} H1:${String(h1).trim().slice(0, 40)}`);
    if (status !== 200) failures++;
  }

  const apis = [
    '/api/mock-data',
    '/api/towers',
    '/api/subscribers',
    '/api/plans',
    '/api/vouchers',
    '/api/bandwidth',
    '/api/reports/subscribers',
  ];
  for (const api of apis) {
    const resp = await page.request.get('http://localhost:3000' + api);
    console.log(`API ${api} -> ${resp.status()}`);
    if (resp.status() !== 200) failures++;
  }

  const actionResp = await page.request.post('http://localhost:3000/api/actions', { data: { action: 'reboot' } });
  console.log(`API /api/actions -> ${actionResp.status()}`);
  if (actionResp.status() !== 200) failures++;

  await browser.close();
  if (pageErrors.length) {
    console.log('PAGE_ERRORS', pageErrors);
    failures++;
  }
  console.log(failures === 0 ? 'E2E_OK' : `E2E_FAIL ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
