import { describe, expect, it } from "vitest";
import { publicDeployment } from "./deployment";

const production = {
  VITE_APP_MODE: "production",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture_only",
  VITE_API_URL: "https://thermatwin-api.onrender.com/",
};
describe("deployment isolation", () => {
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
