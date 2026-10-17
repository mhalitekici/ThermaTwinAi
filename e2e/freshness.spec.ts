import { test, expect } from "@playwright/test";
test("fresh fetch and processing times never make an old observation current", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-10-22T12:00:00Z") });
  await page.route("**/live.json", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.checked_at = body.source.retrieved_at = "2026-10-22T12:00:00Z";
    await route.fulfill({ response, json: body });
  });
  await page.goto("/dashboard");
  const chronology = page.getByRole("region", {
    name: "Verinin zaman çizelgesi",
  });
  await expect(chronology).toContainText("Gecikmiş gözlem");
  await expect(chronology).toContainText("16 Ekim 2026");
  await expect(chronology).toContainText("22 Eki 2026");
  await expect(chronology).toContainText("gözlem yaşı: 6 gün");
  await chronology.getByText("Yayın gecikmesi ve monitoring hakkında").click();
  await expect(chronology).toContainText("bu snapshot ile doğrulanamıyor");
  await expect(chronology).toContainText(
    "Eski veri için canlı e-posta bastırılır",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/product-upgrade/ci/freshness-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
