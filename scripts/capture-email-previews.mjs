import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const stage = process.argv[2] || "after";
const directory = `artifacts/product-upgrade/email-${stage}`;
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [390, 768, 1366, 1920])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const network = [];
      await context.route("**/*", (route) => {
        if (route.request().url().startsWith("file:")) return route.continue();
        network.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      for (const name of ["manual-test", "observed", "forecast"]) {
        await page.goto(pathToFileURL(resolve(directory, `${name}.html`)).href);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const violations =
          stage === "after"
            ? (
                await new AxeBuilder({ page })
                  .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                  .analyze()
              ).violations.map((v) => ({
                id: v.id,
                targets: v.nodes.map((n) => n.target),
              }))
            : [];
        await page.screenshot({
          path: `${directory}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
        results.push({ name, width, theme, overflow, violations });
      }
      if (network.length)
        throw new Error("Email preview attempted an external request");
      await context.close();
    }
} finally {
  await browser.close();
  writeFileSync(`${directory}/results.json`, JSON.stringify(results, null, 2));
}
const failures = results.filter((r) => r.overflow || r.violations.length);
console.log(JSON.stringify({ screenshots: results.length, failures }));
if (failures.length) process.exitCode = 1;
