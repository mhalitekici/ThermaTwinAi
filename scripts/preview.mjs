import { chromium, devices } from "playwright";
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(
      mobile
        ? { ...devices["iPhone 13"], defaultBrowserType: undefined }
        : { viewport: { width: 1440, height: 1100 } },
    );
    page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
    await page.goto("http://127.0.0.1:5173/dashboard", {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".side-mode").evaluate((el) => el.click());
    await page.locator(".notice.replay").waitFor();
    console.log("replay loaded", mobile);
    await page.screenshot({
      path: `artifacts/dashboard-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    console.log("screenshot saved", mobile);
    await page
      .locator(".history-panel .segmented button")
      .first()
      .click({ timeout: 10000 });
    console.log("30d click complete", mobile);
    await page.locator(".chart-tabs button").nth(1).click({ timeout: 10000 });
    console.log("anomaly click complete", mobile);
    await page.close();
  }
} finally {
  await browser.close();
}
