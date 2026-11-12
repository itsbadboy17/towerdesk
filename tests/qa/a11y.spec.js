import { test, expect } from "@playwright/test";
import { routes, waitForPageStable } from "./helpers.js";
import AxeBuilder from "@axe-core/playwright";

routes.forEach((route) => {
  test(`A11y compliance on route ${route}`, async ({ page }) => {
    await page.goto(`http://localhost:3000${route}`);
    await waitForPageStable(page);

    const results = await new AxeBuilder({ page }).analyze();
    const criticalIssues = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalIssues.length > 0) {
      const details = criticalIssues
        .map(
          (v) =>
            `  - ${v.help} (${v.impact}): ${v.nodes.map((n) => n.target.join(", ")).join(", ")}`
        )
        .join("\n");
      throw new Error(`Critical/serious a11y issues on ${route}:\n${details}`);
    }
  });
});
