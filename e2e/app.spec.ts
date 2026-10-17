import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-16T17:00:00Z") });
});

test("overview separates actual and future data, themes persist, no horizontal overflow", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Denize daha yakından bakın." }),
  ).toBeVisible();
  await expect(page.locator(".temperature-value")).toContainText("26,5");
  await expect(page.locator(".forecast-cards article")).toHaveCount(3);
  await expect(page.locator(".forecast-summary")).toContainText("17 Eki 2026");
  await expect(page.locator(".forecast-summary")).toContainText("19 Eki 2026");
  await expect(page.locator(".risk-insight").first()).toContainText(
    "Sıcak gün eşiği aşılmıyor.",
  );
  await expect(page.locator(".chart-legend")).toContainText("Model tahmini");
  await page.getByRole("button", { name: "14 gün", exact: true }).click();
  await page.getByRole("button", { name: "Anomali", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mevsimsel sıcaklık farkı" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Koyu temaya geç" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/dark-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("replay has real comparisons, survives navigation and reload, report download and keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/history");
  const event = page
    .locator(".event-options button")
    .filter({ hasText: "7 Haziran 2024" });
  await event.click();
  await expect(page.locator(".notice.replay")).toContainText(
    "Güncel uyarı değildir.",
  );
  await expect(page.locator(".comparison-card.event")).toContainText("27,0");
  await expect(page.locator(".comparison-grid")).toContainText(
    "GÖZLENMİŞ NORMAL GÜN",
  );
  await page.getByRole("button", { name: "Olay raporunu aç" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("GEÇMİŞ OLAY TEKRARI");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Raporu indir" }).click();
  expect((await download).suggestedFilename()).toBe(
    "ThermaTwin_2024-06-07.txt",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Olay raporunu aç" }),
  ).toBeFocused();
  await page
    .getByRole("link", { name: "Olay tarihindeki model tahminleri" })
    .click();
  await expect(page).toHaveURL(/mode=replay.*event=2024-06-07/);
  await expect(page.locator(".forecast-summary")).toContainText("8 Haz 2024");
  await page.reload();
  await expect(page.locator(".notice.replay")).toContainText("7 Haziran 2024");
  await page.getByRole("button", { name: "Son gözleme dön" }).click();
  await expect(page.locator(".forecast-summary")).toContainText("17 Eki 2026");
});

test("navigation, honest local subscriptions and model details", async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (
      /(^|\.)supabase\.(co|com|io)$|(^|\.)resend\.com$|^generativelanguage\.googleapis\.com$/.test(
        new URL(r.url()).hostname,
      )
    )
      outgoing.push(r.url());
  });
  await page.goto("/dashboard");
  if (await page.getByRole("button", { name: "Menüyü aç" }).isVisible()) {
    const menu = page.getByRole("button", { name: "Menüyü aç" });
    await menu.click();
    await expect(page.locator(".app-body")).toHaveAttribute("inert", "");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(page.locator(".app-body")).not.toHaveAttribute("inert", "");
    await menu.click();
  }
  await page.getByRole("link", { name: "Deniz izleme", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deniz bölgeleri", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Bölgeyi izlemeye al" }).click();
  await expect(
    page.getByText("Yerel demo davranışı", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Yerel izleme tercihini kaydet" })
    .click();
  await expect(
    page.getByText("Yerel tercih kaydedildi", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Yerel izleme tercihini kaldır" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Yerel izleme tercihini kaldır" })
    .click();
  await page.goto("/performance");
  await expect(page.locator(".performance-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".performance-table tbody")).toContainText("0,352");
  await expect(page.locator(".audit-checks")).toContainText("Doğrulandı");
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Doğrulama kodu gönder" }),
  ).toBeDisabled();
  expect(outgoing).toEqual([]);
});

test("accessibility in light and dark overview", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator(".temperature-value")).toContainText("26,5");
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("button", { name: "Koyu temaya geç" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
});

test("old observations are dated and loading errors recover without fabricated data", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-22T17:00:00Z"));
  await page.goto("/dashboard");
  await expect(
    page.getByText("Veri gecikmiş olabilir", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".early-warning")).toContainText(
    "Yetersiz veya güncel olmayan veri",
  );
  await page.goto("/alerts");
  await expect(page.locator(".report-row")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-10-16T17:00:00Z"));
  await page.goto("/dashboard");
  await page.route("**/live.json", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":"ready","mode":"replay"}',
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Veri yüklenemedi");
  await expect(page.locator(".temperature-value")).toHaveCount(0);
  await page.unroute("**/live.json");
  await page.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(page.locator(".temperature-value")).toContainText("26,5");
});

test("measured warning rules, intervals and successful and false early-warning replay are inspectable", async ({
  page,
}) => {
  await page.goto("/forecasts");
  await expect(page.locator(".early-warning")).toContainText("Normal koşullar");
  await page
    .getByRole("button", { name: "+24 saat tahmin aralığı açıklaması" })
    .click();
  await expect(page.getByRole("tooltip")).toContainText(
    "ayrı testte bu ufukta ölçülen kapsama %81,7",
  );
  await expect(page.locator(".forecast-risk-grid")).toContainText(
    "validation ile seçilen",
  );
  await page.goto("/history");
  await page
    .locator(".event-options button")
    .filter({ hasText: "Olaydan önce sinyal" })
    .click();
  await expect(page.locator(".early-warning")).toContainText(
    "Geleceğe yönelik sıcaklık anomalisi riski",
  );
  await expect(
    page.getByText(/Sonradan gözlenen sonuç: beş günlük P90 olayı/),
  ).toContainText("2025-01-30");
  await page.reload();
  await expect(page.locator(".early-warning")).toContainText("Ufuk: 72 saat");
  await page
    .locator(".event-options button")
    .filter({ hasText: "Olay oluşmayan sinyal" })
    .click();
  await expect(
    page.getByText(/Sonradan gözlenen sonuç: uyarının hedefi/),
  ).toContainText("yanlış olay uyarısı");
  await page.goto("/performance");
  await expect(
    page.getByRole("heading", { name: "Rolling-origin · 2019–2026" }),
  ).toBeVisible();
  await expect(page.locator(".reliability-results")).toContainText("49 kayıt");
  await expect(page.locator(".reliability-results")).toContainText("66");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("alert filters, map controls, theme settings and page widths remain usable", async ({
  page,
}) => {
  await page.goto("/alerts?mode=replay&event=2024-06-07");
  await expect(page.locator(".report-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Gözlemlenen", exact: true }).click();
  await expect(page.locator(".report-row")).toHaveCount(1);
  await expect(page.locator(".report-row")).toContainText(
    "Gözlemlenen sıcaklık anomalisi",
  );
  await page
    .getByRole("button", { name: "Tahmin edilen", exact: true })
    .click();
  await expect(page.locator(".report-row")).toContainText(
    "Tahmin edilen eşik aşımı",
  );
  await page.getByRole("button", { name: /Tahmin edilen eşik aşımı/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Raporu kapat" }).click();
  for (const path of ["/settings", "/regions", "/performance", "/history"]) {
    await page.goto(path);
    await expect(page.locator("#page-title")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
    if (path === "/settings") {
      await page
        .getByRole("button", { name: "Koyu tema", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page
        .getByRole("button", { name: "Açık tema", exact: true })
        .click();
    }
    if (path === "/regions") {
      await expect(page.locator(".leaflet-container")).toBeVisible();
      await page
        .getByRole("button", { name: "Haritayı Akkuyu bölgesine ortala" })
        .click();
      await page
        .getByRole("button", { name: "Uydu görünümü", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Temel harita", exact: true }),
      ).toBeVisible();
    }
  }
});
