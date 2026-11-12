const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/qa',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['json', { outputFile: 'tests/qa/reports/results.json' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'node server.js',
    // Automated QA runs without the login screen. If a server with login enabled is
    // already running on port 3000, stop it first or the tests will hit /login.
    // Use a separate data folder so tests never see or change the user's saved devices.
    env: { TOWERDESK_AUTH: 'off', TOWERDESK_HISTORY: 'off', TOWERDESK_DATA_DIR: require('path').join(require('os').tmpdir(), 'towerdesk-qa-data') },
    port: 3000,
    baseURL: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'desktop-1366x768-en',
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'desktop-1920x1080-en',
      use: { viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'tablet-768x1024-en',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-360x740-en',
      use: { viewport: { width: 360, height: 740 } },
    },
    {
      name: 'desktop-1366x768-ar',
      use: {
        viewport: { width: 1366, height: 768 },
        locale: 'ar-SA',
        extraHTTPHeaders: { 'Accept-Language': 'ar-SA' },
      },
    },
  ],
});
