import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:5177/__test__/reset");
});

test("OTP → session → explicit Akkuyu consent → historical monitoring → report → TEST mail → dedupe → cancellation → private history", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("E-posta adresi").fill("alice@example.test");
  await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
  await expect(
    page.getByLabel("Doğrulama kodu", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Yeniden gönder/ }),
  ).toBeDisabled();
  await page.getByLabel("Doğrulama kodu", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Doğrula ve devam et" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Kod geçersiz veya süresi dolmuş",
  );
  await page.getByLabel("Doğrulama kodu", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Doğrula ve devam et" }).click();
  await expect(page).toHaveURL(/subscriptions/);
  await page.getByRole("button", { name: "İzlemeyi etkinleştir" }).click();
  await expect(page.getByText("İzleme etkin", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bildirimleri aç" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bildirimleri aç" }).click();
  await expect(page.getByText("Açık onay var", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("alice@example.test", { exact: true }),
  ).toBeVisible();
  expect(
    (await request.post("http://127.0.0.1:5177/__test__/monitor")).ok(),
  ).toBe(true);
  expect(
    (await (await request.get("http://127.0.0.1:5177/__test__/state")).json())
      .mails,
  ).toHaveLength(0);
  await page.goto("/alerts?mode=replay&event=2024-06-07");
  await expect(page.locator(".report-row")).toHaveCount(2);
  await expect(
    page.getByText("SHADOW · Otomatik gerçek gönderim kapalı"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "TEST e-postası gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "TEST e-postası Resend tarafından kabul edildi",
  );
  await expect(page.locator(".delivery-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Teslim durumunu kontrol et" })
    .click();
  await expect(page.locator(".delivery-status")).toContainText(
    "Alıcının posta sunucusuna teslim edildi",
  );
  const sent = (
    await (await request.get("http://127.0.0.1:5177/__test__/state")).json()
  ).mails;
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toContain("TEST");
  expect(sent[0].html).toContain("27.01 °C");
  expect(sent[0].text).toContain("GEÇMİŞ OLAY TEKRARI");
  await page
    .getByRole("button", { name: "TEST e-postası gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Yeni gönderim yapılmadı",
  );
  await page.goto("/alerts");
  await expect(page.locator(".delivery-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "TEST e-postası gönder", exact: true }),
  ).toBeEnabled();
  const accessibility = await new AxeBuilder({ page })
    .include(".notification-card")
    .include(".delivery-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations,
    JSON.stringify(
      accessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  ).toEqual([]);
  expect(
    (await (await request.get("http://127.0.0.1:5177/__test__/state")).json())
      .mails,
  ).toHaveLength(1);
  await page.goto("/subscriptions");
  await page.getByRole("button", { name: "Bildirimleri durdur" }).click();
  await expect(page.getByText("Kapalı", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aboneliği iptal et" }).click();
  await page.getByRole("button", { name: "İzlemeyi etkinleştir" }).click();
  const state = await (
    await request.get("http://127.0.0.1:5177/__test__/state")
  ).json();
  expect(state.subscriptions).toHaveLength(1);
  expect(state.subscriptions[0].email_enabled).toBe(false);
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.goto("/login");
  await page.getByLabel("E-posta adresi").fill("bob@example.test");
  await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
  await page.getByLabel("Doğrulama kodu", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Doğrula ve devam et" }).click();
  await expect(page).toHaveURL(/subscriptions/);
  await expect(
    page.getByText("bob@example.test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("İzleme kapalı", { exact: true })).toBeVisible();
  await page.goto("/alerts?mode=replay&event=2024-06-07");
  await expect(page.locator(".delivery-row")).toHaveCount(0);
  await expect(
    page.getByText("Bu görünümde hesabınıza ait kayıt yok."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "TEST e-postası gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Önce Akkuyu aboneliğini açıp bilgi e-postaları için açık onay verin",
  );
  // A second verified account with explicit consent can send only to itself.
  await page.goto("/subscriptions");
  await page.getByRole("button", { name: "İzlemeyi etkinleştir" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Bildirimleri aç" }).click();
  await expect(page.getByText("Açık onay var", { exact: true })).toBeVisible();
  await page.goto("/alerts?mode=replay&event=2024-06-07");
  await expect(
    page.getByText("bob@example.test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "TEST e-postası gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "TEST e-postası Resend tarafından kabul edildi",
  );
  await expect(page.locator(".delivery-row")).toHaveCount(1);
  const ownMessages = (
    await (await request.get("http://127.0.0.1:5177/__test__/state")).json()
  ).mails;
  expect(ownMessages).toHaveLength(2);
  expect(ownMessages[0].to).toEqual(["alice@example.test"]);
  expect(ownMessages[1].to).toEqual(["bob@example.test"]);
  await page
    .getByRole("button", { name: "TEST e-postası gönder", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Yeni gönderim yapılmadı",
  );
  expect(
    (await (await request.get("http://127.0.0.1:5177/__test__/state")).json())
      .mails,
  ).toHaveLength(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("offline mail service recovers on retry without sending a message", async ({
  page,
}) => {
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/alerts");
  await expect(page.locator(".notification-card")).toContainText(
    "Bağlantı yok",
  );
  await expect(
    page.getByRole("button", { name: "TEST e-postası gönder", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/health");
  await page.getByRole("button", { name: "Bağlantıyı yeniden dene" }).click();
  await expect(page.locator(".notification-card")).toContainText(
    "Servis hazır",
  );
  await expect(page.locator(".notification-card")).toContainText(
    "TEST göndermek için giriş yapın",
  );
});

for (const token of ["01234567", "0123456789"]) {
  test(`${token.length}-digit OTP keeps leading zero and reaches Auth without truncation`, async ({
    page,
  }) => {
    const submittedTokens: unknown[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("/auth/v1/verify")
      )
        submittedTokens.push(request.postDataJSON().token);
    });
    await page.goto("/login");
    await page.getByLabel("E-posta adresi").fill("alice@example.test");
    await page.getByRole("button", { name: "Doğrulama kodu gönder" }).click();
    const input = page.getByLabel("Doğrulama kodu", { exact: true });
    await expect(input).toBeVisible();
    await expect(page.getByText(/6 haneli/)).toHaveCount(0);
    await input.fill("01234");
    await page.getByRole("button", { name: "Doğrula ve devam et" }).click();
    expect(
      await input.evaluate((field: HTMLInputElement) => field.checkValidity()),
    ).toBe(false);
    expect(submittedTokens).toEqual([]);
    await input.fill(token);
    await expect(input).toHaveValue(token);
    await page.getByRole("button", { name: "Doğrula ve devam et" }).click();
    await expect(page).toHaveURL(/subscriptions/);
    expect(submittedTokens).toEqual([token]);
    await expect(
      page.getByText("alice@example.test", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("expired session refreshes through Auth and rejected refresh returns to login", async ({
  page,
  request,
}) => {
  const response = await request.post("http://127.0.0.1:5177/auth/v1/verify", {
    data: { email: "alice@example.test", token: "123456", type: "email" },
  });
  const session = await response.json();
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  await page.goto("/login");
  await page.evaluate(
    (value) => localStorage.setItem("thermatwin-auth", JSON.stringify(value)),
    session,
  );
  let refreshes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/auth/v1/token")) refreshes++;
  });
  await page.reload();
  await expect(page).toHaveURL(/subscriptions/);
  await expect(
    page.getByText("alice@example.test", { exact: true }),
  ).toBeVisible();
  expect(refreshes).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error_code: "refresh_token_not_found",
        msg: "TEST revoked refresh",
      }),
    }),
  );
  await page.evaluate(
    (value) => localStorage.setItem("thermatwin-auth", JSON.stringify(value)),
    session,
  );
  await page.goto("/login");
  await expect(page.getByLabel("E-posta adresi")).toBeVisible();
  await expect(
    page.getByText("alice@example.test", { exact: true }),
  ).toHaveCount(0);
});
