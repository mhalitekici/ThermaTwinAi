import { describe, expect, it } from "vitest";
import source from "../public/live.json";
import type { Snapshot } from "./lib";
import { freshnessState, timestamp } from "./freshness";
const snap = source as Snapshot;
describe("observation, fetch, processing and monitoring are distinct", () => {
  it("dates the saved observation and never promotes a new fetch to a new observation", () => {
    expect(
      freshnessState(snap, Date.parse("2026-10-17T23:59:59Z")).status,
    ).toBe("current");
    const old = structuredClone(snap);
    old.checked_at = old.source.retrieved_at = "2026-10-22T12:00:00Z";
    expect(
      freshnessState(old, Date.parse("2026-10-22T12:00:00Z")),
    ).toMatchObject({ status: "delayed", age: 6 });
  });
  it("keeps historical replay separate from live freshness", () => {
    expect(
      freshnessState(
        { ...snap, mode: "replay" },
        Date.parse("2027-01-01T00:00:00Z"),
      ).status,
    ).toBe("historical");
  });
  it("rejects future, malformed and non-finite observations", () => {
    expect(
      freshnessState(snap, Date.parse("2026-10-15T23:59:59Z")).status,
    ).toBe("unavailable");
    for (const day of ["invalid", "2026-02-30"])
      expect(freshnessState({ ...snap, origin_date: day }).status).toBe(
        "unavailable",
      );
    expect(
      freshnessState({
        ...snap,
        observation: { ...snap.observation, sst_c: NaN },
      }).status,
    ).toBe("unavailable");
  });
  it("requires fifteen actual consecutive calendar days, with a strict three-day boundary", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    expect(freshnessState(snap, now).status).toBe("current");
    expect(freshnessState(snap, now + 86400000).status).toBe("delayed");
    const missing = structuredClone(snap);
    missing.history.at(-2)!.sst_c = null;
    expect(freshnessState(missing, now).status).toBe("missing");
    missing.history = missing.history.filter((r) => r.sst_c !== null);
    expect(freshnessState(missing, now).status).toBe("missing");
  });
  it("uses explicit UTC timestamps and rejects date-only/missing publication timestamps", () => {
    expect(timestamp("2026-10-16T12:58:00+00:00")).toContain("12:58 UTC");
    for (const value of [undefined, "bad", "2026-10-16", "2026-10-16T12:00:00"])
      expect(timestamp(value)).toBeNull();
  });
});
