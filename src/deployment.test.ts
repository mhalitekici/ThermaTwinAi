import { describe, expect, it } from "vitest";
import { applicationEnvironment, publicDeployment } from "./deployment";

const production = {
  VITE_APP_MODE: "production",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture_only",
  VITE_API_URL: "https://thermatwin-api.onrender.com/",
};
describe("provider metadata boundary", () => {
  it.each([
    "VITE_VERCEL_PROJECT_ID",
    "VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG",
    "VITE_VERCEL_UNANNOUNCED_FUTURE_FIELD",
  ])(
    "discards %s before application validation, including secret values",
    (name) => {
      for (const target of ["preview", "production"]) {
        for (const value of [
          "PROVIDER_METADATA_FIXTURE_ONLY",
          "sb_secret_PROVIDER_FIXTURE_ONLY",
          "re_PROVIDER_FIXTURE_ONLY_1234567890",
          JSON.stringify({ token: "sb_secret_PROVIDER_JSON_FIXTURE_ONLY" }),
        ]) {
          const appEnv = applicationEnvironment(
            { ...production, [name]: value },
            { VERCEL: "1", VERCEL_ENV: target },
          );
          expect(appEnv).toEqual(production);
          expect(publicDeployment(appEnv, target)).toEqual(
            publicDeployment(production, target),
          );
        }
      }
    },
  );
  it.each([
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: "production" },
    { VERCEL: "0", VERCEL_ENV: "preview" },
    { VERCEL: "true", VERCEL_ENV: "preview" },
    { VERCEL: "1", VERCEL_ENV: "unknown" },
  ])("rejects an incomplete or invalid hosting context: %j", (hosting) => {
    expect(() => applicationEnvironment(production, hosting)).toThrow(
      "Vercel hosting bağlamı doğrulanamadı; build durduruldu.",
    );
  });
  it.each([{}, { VERCEL: "1" }, { VERCEL: "1", VERCEL_ENV: "development" }])(
    "does not trust prefixed metadata as proof of hosting: %j",
    (hosting) => {
      const appEnv = applicationEnvironment(
        { ...production, VITE_VERCEL_ENV: "preview" },
        hosting,
      );
      expect(() => publicDeployment(appEnv)).toThrow(/VITE_VERCEL_ENV/);
    },
  );
  it.each(["VITE_UNKNOWN_USER_SETTING", "VITE_VERCELISH_USER_SETTING"])(
    "keeps %s visible to the strict validator on Vercel",
    (name) => {
      const appEnv = applicationEnvironment(
        { ...production, [name]: "PRIVATE_FIXTURE_ONLY" },
        { VERCEL: "1", VERCEL_ENV: "preview" },
      );
      expect(() => publicDeployment(appEnv, "preview")).toThrow(
        `Bilinmeyen veya gizli VITE_ alanı (${name}); build durduruldu.`,
      );
    },
  );
  it("does not let provider metadata select preview or bypass missing Production connections", () => {
    const appEnv = applicationEnvironment(
      { VITE_APP_MODE: "production", VITE_VERCEL_ENV: "preview" },
      { VERCEL: "1", VERCEL_ENV: "production" },
    );
    expect(() => publicDeployment(appEnv, "production")).toThrow(
      /Production için public Supabase ve HTTPS API adresi gerekli/,
    );
  });
  it("preserves Preview demo isolation with copied live application values and secret metadata", () => {
    const appEnv = applicationEnvironment(
      {
        ...production,
        VITE_ENABLE_LIVE_INTEGRATIONS: "true",
        VITE_VERCEL_PROJECT_ID: "sb_secret_PROVIDER_FIXTURE_ONLY",
      },
      { VERCEL: "1", VERCEL_ENV: "preview" },
    );
    expect(publicDeployment(appEnv, "preview")).toEqual({
      VITE_APP_MODE: "demo",
      VITE_ENABLE_LIVE_INTEGRATIONS: "false",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_API_URL: "",
      VITE_DEPLOYMENT_ENV: "preview",
    });
  });
  it("rejects provider fields sent directly to publicDeployment without the boundary", () => {
    expect(() =>
      publicDeployment({ ...production, VITE_VERCEL_PROJECT_ID: "provider" }),
    ).toThrow(/VITE_VERCEL_PROJECT_ID/);
  });
});

describe("deployment isolation", () => {
  it("reports only the unknown field name, including lookalike Vercel fields", () => {
    for (const name of ["VITE_UNRELATED", "VITE_VERCEL_SECRET"]) {
      expect(() =>
        publicDeployment(
          { ...production, [name]: "PRIVATE_DIAGNOSTIC_FIXTURE_ONLY" },
          "preview",
        ),
      ).toThrow(
        `Bilinmeyen veya gizli VITE_ alanı (${name}); build durduruldu.`,
      );
    }
  });
  it("does not log control characters or arbitrary text in an invalid field name", () => {
    expect(() =>
      publicDeployment({ "VITE_BAD\nPRIVATE_NAME_FIXTURE": "value" }),
    ).toThrow(
      "Bilinmeyen veya gizli VITE_ alanı ([geçersiz alan adı]); build durduruldu.",
    );
  });
  it("still scans every application input for server secret values", () => {
    expect(() =>
      publicDeployment(
        { ...production, VITE_VERCEL_GIT_COMMIT_MESSAGE: "sb_secret_fixture" },
        "preview",
      ),
    ).toThrow(/Public alanda sunucu sırrı/);
  });
  it.each(["development", "preview", "production"])(
    "rejects server secrets that reach application validation in %s",
    (target) => {
      for (const secret of [
        "sb_secret_OBSERVABILITY_FIXTURE_ONLY",
        "re_OBSERVABILITY_FIXTURE_ONLY_1234567890",
      ]) {
        expect(() =>
          publicDeployment(
            {
              ...production,
              VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG: JSON.stringify({
                token: secret,
              }),
            },
            target,
          ),
        ).toThrow("Public alanda sunucu sırrı saptandı; build durduruldu.");
      }
    },
  );
  it.each(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_API_URL"])(
    "requires %s in production",
    (name) => {
      expect(() =>
        publicDeployment({ ...production, [name]: "" }, "production"),
      ).toThrow(/Production için public Supabase ve HTTPS API adresi gerekli/);
    },
  );
  it("rejects a service-role JWT in every deployment environment", () => {
    const serverJwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: "service_role" }))}.fixture`;
    for (const target of ["development", "preview", "production"]) {
      expect(() =>
        publicDeployment(
          { ...production, VITE_SUPABASE_ANON_KEY: serverJwt },
          target,
        ),
      ).toThrow(/public\/publishable/);
    }
  });
  it("rejects a mistyped deployment target and server keys hidden in allowed URL fields", () => {
    expect(() => publicDeployment(production, "prod")).toThrow();
    expect(() =>
      publicDeployment({
        ...production,
        VITE_API_URL: "https://api.example.test/sb_secret_PRIVATE_FIXTURE",
      }),
    ).toThrow();
  });
  it("removes all live connections from preview even when production variables were copied", () => {
    expect(publicDeployment(production, "preview")).toMatchObject({
      VITE_APP_MODE: "demo",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_API_URL: "",
    });
  });
  it.each([
    "http://localhost:8000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test?token=secret",
    "",
  ])("rejects an unsafe hosted API URL: %s", (value) => {
    expect(() =>
      publicDeployment({ ...production, VITE_API_URL: value }, "production"),
    ).toThrow(/build durduruldu/);
  });
  it("requires explicit production mode and public Supabase configuration", () => {
    expect(() => publicDeployment({}, "production")).toThrow();
    expect(() =>
      publicDeployment({ ...production, VITE_APP_MODE: "demo" }, "production"),
    ).toThrow();
    expect(() =>
      publicDeployment(
        { ...production, VITE_SUPABASE_URL: "http://localhost:54321" },
        "production",
      ),
    ).toThrow();
    expect(publicDeployment(production, "production").VITE_API_URL).toBe(
      "https://thermatwin-api.onrender.com",
    );
  });
  it("allows local connected testing without weakening hosted requirements", () => {
    expect(
      publicDeployment({
        ...production,
        VITE_API_URL: "http://127.0.0.1:5177/api",
      }).VITE_API_URL,
    ).toContain("5177/api");
  });
  it.each(["development", "preview", "production"])(
    "rejects secret fields and arbitrary public fields in %s",
    (target) => {
      expect(() =>
        publicDeployment(
          { ...production, VITE_UNRELATED: "PRIVATE_FIXTURE_VALUE" },
          target,
        ),
      ).toThrow(/build durduruldu/);
      expect(() =>
        publicDeployment(
          { ...production, VITE_SUPABASE_ANON_KEY: "sb_secret_fixture" },
          target,
        ),
      ).toThrow();
    },
  );
});
