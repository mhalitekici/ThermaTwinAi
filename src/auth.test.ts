import { describe, it, expect } from "vitest";
import { authError, isPublicSupabaseKey } from "./auth";
describe("public auth configuration", () => {
  it("rejects service-role and secret credentials in the frontend", () => {
    const jwt = (role: string) =>
      `e30.${btoa(JSON.stringify({ role }))}.fixture`;
    expect(isPublicSupabaseKey(jwt("anon"))).toBe(true);
    expect(isPublicSupabaseKey(jwt("service_role"))).toBe(false);
    expect(isPublicSupabaseKey("sb_secret_TEST_ONLY")).toBe(false);
    expect(isPublicSupabaseKey("sb_publishable_TEST_ONLY")).toBe(true);
  });
  it("explains OTP expiry and rate limits without exposing provider details", () => {
    expect(authError({ code: "otp_expired" })).toContain("süresi dolmuş");
    expect(authError({ code: "over_email_send_rate_limit" })).toContain(
      "bekleyip",
    );
    expect(authError(new Error("sensitive test detail"))).not.toContain(
      "sensitive",
    );
  });
});
