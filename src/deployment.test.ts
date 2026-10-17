import { describe, expect, it } from "vitest";
import { publicDeployment } from "./deployment";

const production = {
  VITE_APP_MODE: "production",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture_only",
  VITE_API_URL: "https://thermatwin-api.onrender.com/",
};
describe("deployment isolation", () => {
  // Exact framework metadata names documented by Vercel; no prefix wildcard.
  it.each([
    "VITE_VERCEL_ENV",
    "VITE_VERCEL_TARGET_ENV",
    "VITE_VERCEL_URL",
    "VITE_VERCEL_BRANCH_URL",
    "VITE_VERCEL_PROJECT_PRODUCTION_URL",
    "VITE_VERCEL_HASH_SALT",
    "VITE_VERCEL_GIT_PROVIDER",
    "VITE_VERCEL_GIT_REPO_SLUG",
    "VITE_VERCEL_GIT_REPO_OWNER",
    "VITE_VERCEL_GIT_REPO_ID",
    "VITE_VERCEL_GIT_COMMIT_REF",
    "VITE_VERCEL_GIT_COMMIT_SHA",
    "VITE_VERCEL_GIT_COMMIT_MESSAGE",
    "VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
    "VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME",
    "VITE_VERCEL_GIT_PULL_REQUEST_ID",
    "VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG",
  ])("accepts %s as build metadata without exposing it", (name) => {
    for (const target of ["preview", "production"]) {
      expect(
        publicDeployment(
          { ...production, [name]: "VERCEL_METADATA_FIXTURE_ONLY" },
          target,
        ),
      ).toEqual(publicDeployment(production, target));
    }
  });
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
  it("still scans documented metadata for server secret values", () => {
    expect(() =>
      publicDeployment(
        { ...production, VITE_VERCEL_GIT_COMMIT_MESSAGE: "sb_secret_fixture" },
        "preview",
      ),
    ).toThrow(/Public alanda sunucu sırrı/);
  });
  it.each(["development", "preview", "production"])(
    "rejects server secrets inside observability metadata in %s",
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
    "requires %s in production even with Vercel metadata present",
    (name) => {
      expect(() =>
        publicDeployment(
          { ...production, VITE_VERCEL_ENV: "production", [name]: "" },
          "production",
        ),
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
