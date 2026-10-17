import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("ocean landing uses versioned evidence, real dated observations and both historical outcomes", async ({
  page,
  request,
}, testInfo) => {
  const report = await (await request.get("/reliability-report.json")).json();
  const snapshot = await (await request.get("/live.json")).json();
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (/supabase|resend|generativelanguage/.test(new URL(r.url()).hostname))
      outgoing.push(r.url());
  });
  await page.clock.install({ time: new Date("2026-10-22T17:00:00Z") });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Denizin yarınını",
  );
  await expect(page.locator(".landing-sst")).toContainText(
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(snapshot.observation.sst_c),
  );
  await expect(page.locator(".observation-state")).toContainText(
    "Veri gecikmiş",
  );
  for (const h of [1, 2, 3]) {
    const expected = new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(report.rolling_pooled[String(h)].model.mae_c);
    await expect(
      page.locator(".evidence-grid article").nth(h - 1),
    ).toContainText(expected);
  }
  await expect(page.locator(".landing-case-grid>a")).toHaveCount(2);
  await expect(page.locator(".landing-case-grid")).toContainText(
    "Olay oluşmayan sinyal",
  );
  await expect(page.locator(".landing-case-grid")).toContainText(
    "Olaydan önce sinyal",
  );
  await expect(page.locator("body")).not.toContainText(
    /Climathon|Jüri|Hackathon|yarışma/i,
  );
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Koyu temaya geç" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/product-upgrade/ci/landing-${testInfo.project.name}-${theme}.png`,
      fullPage: true,
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  const faq = page.getByText("Bu veri anlık bir sensör ölçümü mü?", {
    exact: true,
  });
  await faq.click();
  await expect(page.locator("details[open]")).toContainText("Hayır");
  await page
    .getByRole("link", { name: "Canlı gözlemleri keşfet", exact: true })
    .click();
  await expect(page.locator(".topbar")).toBeVisible();
  if (await page.getByRole("button", { name: "Menüyü aç" }).isVisible())
    await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(
    page.getByRole("link", { name: "Model Performansı", exact: true }),
  ).toBeVisible();
  expect(outgoing).toEqual([]);
});

test("landing source failure presents retry and never fabricates observations", async ({
  page,
}) => {
  await page.route("**/live.json", (r) => r.fulfill({ status: 503 }));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Gözleme erişilemiyor" }),
  ).toBeVisible();
  await expect(page.locator(".landing-sst")).toHaveCount(0);
  await page.unroute("**/live.json");
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.locator(".landing-sst")).toBeVisible();
});

test("a failed map base layer preserves geographic context and offers retry", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://tile.openstreetmap.org/**", (r) => {
    requests++;
    return r.abort();
  });
  await page.goto("/regions");
  await expect(page.locator(".map-error")).toContainText(
    "Harita zemini yüklenemedi",
  );
  await expect(page.locator(".map-legend")).toContainText(
    "Nokta: bölge merkezi",
  );
  await expect(
    page.getByRole("button", { name: "Haritayı yeniden yükle" }),
  ).toBeVisible();
  const before = requests;
  await page.getByRole("button", { name: "Haritayı yeniden yükle" }).click();
  await expect.poll(() => requests).toBeGreaterThan(before);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".region-detail")).toContainText("35.95° / 36.15°");
});
