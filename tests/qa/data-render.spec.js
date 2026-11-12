import { test, expect } from "@playwright/test";
import { routes, waitForPageStable, captureConsoleErrors, captureFailedRequests } from "./helpers.js";

// Verify data renders on all routes (not empty, not undefined/NaN/[object Object])
routes.forEach((route) => {
  test(`Data renders on route ${route}`, async ({ page }) => {
    await page.goto(`http://localhost:3000${route}`);
    await waitForPageStable(page);

    const bodyText = await page.locator("body").innerText();

    const badValues = ["undefined", "NaN", "[object Object]"];
    for (const bad of badValues) {
      if (bodyText.includes(bad)) {
        throw new Error(`Route ${route} contains placeholder value "${bad}"`);
      }
    }

    // Route-specific data checks based on what each page renders
    if (route === "/sas") {
      const hasTable = await page.locator("table").count() > 0;
      if (!hasTable) throw new Error(`Route ${route}: expected subscriber table not found`);
    }
    if (route === "/monitoring") {
      // Monitoring page uses device cards, not tables
      const hasCard = await page.locator(".card").count() > 0;
      if (!hasCard) throw new Error(`Route ${route}: expected device card not found`);
    }
    if (route === "/plans") {
      const hasPlanCard = await page.locator(".plan-card").count() > 0;
      if (!hasPlanCard) throw new Error(`Route ${route}: expected plan cards not found`);
    }
    if (route === "/vouchers") {
      const hasTable = await page.locator("table").count() > 0;
      if (!hasTable) throw new Error(`Route ${route}: expected voucher table not found`);
    }
  });
});
