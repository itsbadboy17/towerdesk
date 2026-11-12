import { test, expect } from "@playwright/test";
import { routes, waitForPageStable } from "./helpers.js";
import fs from "fs";
import path from "path";

const viewports = [
  { width: 1366, height: 768, language: "en" },
  { width: 1920, height: 1080, language: "en" },
  { width: 768, height: 1024, language: "en" },
  { width: 360, height: 740, language: "en" },
  { width: 1366, height: 768, language: "ar" },
];

const screenshotsDir = path.join(__dirname, "screenshots");
const reportsDir = path.join(__dirname, "reports");
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const results = [];

for (const route of routes) {
  for (const vp of viewports) {
    const safeRoute = route.replace(/\//g, "_");
    const testName = `visual_${safeRoute}_${vp.width}x${vp.height}_${vp.language}`;
    test(`Visual: ${testName}`, async ({ page }) => {
      if (vp.language === "ar") {
        await page.context().setExtraHTTPHeaders({ "Accept-Language": "ar-SA" });
      }

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`http://localhost:3000${route}`);
      await waitForPageStable(page);

      if (vp.language === "ar") {
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
      }

      const screenshotPath = path.join(screenshotsDir, `${testName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      results.push({
        route,
        viewport: `${vp.width}x${vp.height}`,
        language: vp.language,
        screenshot: path.relative(__dirname, screenshotPath),
      });
    });
  }
}

test("visual report saved", async () => {
  const reportPath = path.join(reportsDir, "visual-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  expect(results.length).toBeGreaterThan(0);
});
