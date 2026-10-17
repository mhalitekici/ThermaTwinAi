import { expect, test } from "@playwright/test";

test("all SPA routes support a direct visit and refresh through deployment rewrites", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-16T17:00:00Z") });
  for (const path of [
    "/",
    "/dashboard",
    "/login",
    "/alerts",
    "/forecasts",
    "/subscriptions",
    "/regions",
    "/history",
    "/performance",
    "/settings",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    const reloaded = await page.reload();
    expect(reloaded?.status(), path).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("/history?mode=replay&event=2024-06-07");
  await expect(page.locator(".comparison-card.event")).toContainText("27,0");
});

test("static files and unknown API paths are not rewritten to HTML", async ({
  request,
  page,
}) => {
  for (const path of [
    "/live.json",
    "/replay.json",
    "/reliability-snapshots.json",
  ]) {
    const result = await request.get(path);
    expect(result.status()).toBe(200);
    expect(result.headers()["content-type"]).toContain("application/json");
    expect(await result.json()).toBeTruthy();
  }
  for (const path of [
    "/api/health",
    "/api/replay",
    "/assets/missing.js",
    "/missing.json",
    "/.env",
  ]) {
    const result = await request.get(path);
    expect(result.status(), path).toBe(404);
    expect(result.headers()["content-type"] || "").not.toContain("text/html");
  }
  await page.goto("/");
  const script = await page
    .locator('script[type="module"][src]')
    .getAttribute("src");
  const asset = await request.get(script!);
  expect(asset.status()).toBe(200);
  expect(asset.headers()["content-type"]).toContain("javascript");
});
