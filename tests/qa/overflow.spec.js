import { test, expect } from "@playwright/test";
import { routes, waitForPageStable, captureConsoleErrors, captureFailedRequests } from "./helpers.js";

routes.forEach((route) => {
  test(`Route ${route} has no overflow issues`, async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    const failedReqs = captureFailedRequests(page);

    await page.goto(`http://localhost:3000${route}`);
    await waitForPageStable(page);

    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth;
    });

    if (bodyOverflow) {
      throw new Error(`Horizontal scroll detected on route: ${route}`);
    }

    const offendingElements = await page.evaluate(() => {
      const elements = [];
      const all = document.querySelectorAll("*");
      all.forEach((el) => {
        const tag = el.tagName;
        const style = window.getComputedStyle(el);
        if (tag === "TABLE" && style.overflowX === "auto") return;
        if (style.overflowX === "hidden" || style.overflowX === "clip" || style.overflowX === "auto" || style.overflowX === "scroll") return;
        if (el.scrollWidth > el.clientWidth + 1) {
          let selector = tag;
          if (el.id) selector += `#${el.id}`;
          if (el.className) selector += `.${String(el.className).split(" ").join(".")}`;
          elements.push({ selector, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
        }
      });
      return elements;
    });

    if (offendingElements.length > 0) {
      const details = offendingElements
        .map((e) => `  - ${e.selector}: scrollWidth=${e.scrollWidth} > clientWidth=${e.clientWidth}`)
        .join("\n");
      throw new Error(`Overflow detected on route: ${route}\n${details}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors on ${route}: ${consoleErrors.join("; ")}`);
    }
    if (failedReqs.length > 0) {
      throw new Error(`Failed requests on ${route}: ${failedReqs.join("; ")}`);
    }
  });
});
