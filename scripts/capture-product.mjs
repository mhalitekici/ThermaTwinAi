import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const stage = process.argv[2] || "after";
const base = process.env.PRODUCT_PREVIEW_URL || "http://127.0.0.1:5188";
const directory = `artifacts/product-upgrade/${stage}`;
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 768, 1366, 1920]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        (theme) => localStorage.setItem("thermatwin-theme", theme),
        theme,
      );
      const blocked = [];
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (
          url.origin === new URL(base).origin ||
          /(^|\.)(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com)$/.test(
            url.hostname,
          )
        )
          return route.continue();
        blocked.push(url.hostname);
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const [name, path] of Object.entries({
        landing: "/",
        dashboard: "/dashboard",
        forecasts: "/forecasts",
        alerts: "/alerts?mode=replay&event=2024-06-07",
        history: "/history?mode=replay&event=2025-01-27",
        performance: "/performance",
        regions: "/regions",
        subscriptions: "/subscriptions",
        settings: "/settings",
        login: "/login",
      })) {
        await page.goto(base + path);
        await page.locator("h1:visible, h2:visible").first().waitFor();
        if (name === "dashboard")
          await page.locator(".temperature-value").waitFor();
        if (name === "performance")
          await page.locator(".reliability-results").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        await page.screenshot({
          path: `${directory}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        results.push({ name, width, theme, overflow, errors: [...errors] });
        if (name === "dashboard" && width === 390) {
          await page.getByRole("button", { name: "Menüyü aç" }).click();
          await page.screenshot({
            path: `${directory}/navigation-${width}-${theme}.png`,
            fullPage: true,
          });
          await page.keyboard.press("Escape");
        }
      }
      if (
        blocked.some((host) => /supabase|resend|generativelanguage/.test(host))
      )
        throw new Error("Unexpected live provider request in isolated preview");
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
}
console.log(
  `Captured ${results.length} route/theme/viewport combinations; overflow: ${results.filter((r) => r.overflow).length}; page errors: ${results.filter((r) => r.errors.length).length}.`,
);
