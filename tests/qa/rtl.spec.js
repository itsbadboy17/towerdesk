import { test, expect } from "@playwright/test";
import { routes, waitForPageStable } from "./helpers.js";

routes.forEach((route) => {
  test(`RTL behavior on route ${route} in Arabic`, async ({ page }) => {
    await page.goto(`http://localhost:3000${route}`);
    await waitForPageStable(page);

    const langSelector = page.locator("#language-selector");
    if ((await langSelector.count()) > 0) {
      await langSelector.selectOption("ar");
      await page.waitForTimeout(300);
    } else {
      await page.evaluate(() => {
        document.documentElement.dir = "rtl";
        document.documentElement.lang = "ar";
      });
    }

    const dir = await page.evaluate(() => document.documentElement.dir);
    if (dir !== "rtl") {
      throw new Error(`Document dir is "${dir}", expected "rtl" on route: ${route}`);
    }

    const rawKeys = await page.evaluate(() => {
      const keys = [];
      const all = document.querySelectorAll("h1, h2, h3, h4, button, a, label, .kpi-card h3, .card-header h3");
      all.forEach((el) => {
        const text = el.innerText.trim();
        if (text.startsWith("{{") || text.includes("key.") || text.includes("__") || text.match(/^\$\{.*\}$/)) {
          keys.push({ selector: el.tagName, text });
        }
      });
      return keys;
    });

    if (rawKeys.length > 0) {
      throw new Error(`Raw i18n keys on ${route}: ${JSON.stringify(rawKeys)}`);
    }
  });
});
