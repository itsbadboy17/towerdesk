/**
 * Shared helpers for QA tests
 */

export const routes = [
  "/",
  "/sas",
  "/monitoring",
  "/billing",
  "/vouchers",
  "/alerts",
  "/tickets",
  "/add-device",
  "/invoices",
  "/map",
  "/plans",
  "/remote",
  "/settings",
];

export const waitForPageStable = async (page) => {
  // Wait for network to be idle (no more than 0 connections for 500ms)
  await page.waitForLoadState("networkidle");
  // Small extra delay for JS rendering
  await page.waitForTimeout(300);
};

export const captureConsoleErrors = (page) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
};

export const captureFailedRequests = (page) => {
  const failures = [];
  page.on("requestfailed", (req) => {
    failures.push(`${req.url()} (${req.failure()?.errorText || "unknown"})`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failures.push(`${res.url()} (${res.status()})`);
    }
  });
  return failures;
};

export const getPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

export const dummyData = {
  subscribers: 200,
  towers: 2,
  devices: 12,
  plans: 3,
  vouchers: 3,
};
