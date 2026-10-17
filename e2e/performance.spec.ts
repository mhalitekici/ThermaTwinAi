import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("Performance Lab synchronizes real held-out subsets and exports its exact scope", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/performance");
  await expect(page.getByTestId("lab-scope")).toContainText("N=2838");
  await expect(page.locator(".lab-baselines")).toContainText("0,2484");
  await page.getByRole("button", { name: /\+72 saat · MAE/ }).click();
  await expect(page.getByTestId("lab-scope")).toContainText("+72 saat");
  await page.getByLabel("Hedef yılı").selectOption("2025");
  await page.getByLabel("Hedef mevsimi").selectOption("JJA");
  await page.getByLabel("Olay / alt grup").selectOption("rising");
  await expect(page.getByTestId("lab-scope")).toContainText("2025");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Bilimsel HTML raporu" }).click();
  const report = await download;
  const html = await readFile((await report.path())!, "utf8");
  expect(html).toContain("mevsim: JJA");
  expect(html).toContain("olay: rising");
  expect(html).toContain("+72 saat");
  expect(html).toContain("2025-06");
  expect(html).not.toMatch(/<script|<img|<iframe/);
  await page.getByRole("button", { name: "Filtreleri sıfırla" }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/product-upgrade/ci/performance-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
  }
});

test("Performance Lab rejects corrupted evidence and offers retry without invented results", async ({
  page,
}) => {
  await page.route("**/performance-traces-v1.json", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.horizons["1"][0][3] = 80;
    await route.fulfill({ response, json: body });
  });
  await page.goto("/performance");
  await expect(page.getByRole("alert")).toContainText("eşleşmiyor");
  await expect(page.locator(".lab-baselines")).toHaveCount(0);
  await page.unroute("**/performance-traces-v1.json");
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.getByTestId("lab-scope")).toContainText("N=2838");
});
