import { test, expect } from "@playwright/test";
import { routes, waitForPageStable, captureConsoleErrors, captureFailedRequests } from "./helpers.js";

// Click every visible clickable control on every route.
// Only click buttons and form controls (not <a> links) to avoid navigation loops.
routes.forEach((route) => {
  test(`Click actions on route ${route}`, async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    const failedReqs = captureFailedRequests(page);

    await page.goto(`http://localhost:3000${route}`);
    await waitForPageStable(page);

    let clicked = 0;
    const clickableSelectors = ["button", 'input[type="button"]', 'input[type="submit"]', 'input[type="checkbox"]', 'input[type="radio"]', "select"];

    for (const sel of clickableSelectors) {
      const elements = await page.locator(sel).all();
      for (const el of elements) {
        try {
          if (!(await el.isVisible()) || (await el.isDisabled())) continue;
          await el.click();
          await page.waitForTimeout(50);
          clicked++;
          // After clicking, check if we navigated away - if so, stop clicking
          const currentUrl = page.url();
          if (!currentUrl.startsWith(`http://localhost:3000${route}`)) {
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors after clicks on ${route}: ${consoleErrors.join("; ")}`);
    }
    if (failedReqs.length > 0) {
      throw new Error(`Failed requests after clicks on ${route}: ${failedReqs.join("; ")}`);
    }

    console.log(`Clicked ${clicked} elements on ${route}`);
  });
});
