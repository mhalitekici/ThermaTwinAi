import { describe, it, expect } from "vitest";
import source from "../public/live.json";
import enriched from "../public/reliability-snapshots.json";
import type { Snapshot } from "./lib";
import { mergeReliabilitySnapshot, validateSnapshot } from "./lib";
import { chartRows, isStale, riskDetail } from "./science";
const snapshot = source as Snapshot;
describe("honest observation and forecast presentation", () => {
  it("has no future actual values and preserves exact model predictions", () => {
    const rows = chartRows(snapshot, 14);
    const future = rows.filter((r) => r.date > snapshot.origin_date);
    expect(future).toHaveLength(3);
    expect(future.every((r) => r.actual === null)).toBe(true);
    expect(future.map((r) => r.predicted)).toEqual(
      snapshot.forecasts.map((f) => f.sst_c),
    );
  });
  it("joins forecast at the actual origin without moving its date", () => {
    const rows = chartRows(snapshot, 14);
    const origin = rows.find((r) => r.date === snapshot.origin_date)!;
    expect(origin.predicted).toBe(origin.actual);
    expect(rows.at(-1)?.date).toBe(snapshot.forecasts[2].target_date);
  });
  it("preserves missing actual days rather than connecting them as observations", () => {
    const copy = structuredClone(snapshot);
    copy.history.at(-2)!.sst_c = null;
    expect(chartRows(copy, 14).at(-5)?.actual).toBeNull();
  });
  it("can render history without future estimates", () => {
    expect(
      chartRows(snapshot, 30, false).every(
        (r) => r.date <= snapshot.origin_date && r.predicted === null,
      ),
    ).toBe(true);
  });
  it("does not label a positive seasonal difference as an exceedance", () => {
    const info = riskDetail({
      sst_c: 26.5,
      reference_c: 25.9,
      p90_c: 27,
      risk: "normal",
    });
    expect(info.exceed).toBeLessThan(0);
    expect(info.meaning).toBe("Sıcak gün eşiği aşılmıyor.");
  });
  it("explains threshold excess from real temperature values", () => {
    const info = riskDetail({
      sst_c: 29,
      reference_c: 25,
      p90_c: 27,
      risk: "high",
    });
    expect(info.difference).toBe(4);
    expect(info.exceed).toBe(2);
  });
  it("marks live observations stale after three full calendar days", () => {
    expect(isStale(snapshot, Date.parse("2026-10-19T23:59:59Z"))).toBe(false);
    expect(isStale(snapshot, Date.parse("2026-10-20T00:00:00Z"))).toBe(true);
  });
  it("does not present historical replay as stale live data", () => {
    expect(
      isStale({ ...snapshot, mode: "replay" }, Date.parse("2027-01-01")),
    ).toBe(false);
  });
  it("accepts the verified real snapshot", () => {
    expect(validateSnapshot(snapshot, "live")).toBe(snapshot);
  });
  it("rejects mixed modes and mismatched origins", () => {
    expect(() => validateSnapshot(snapshot, "replay")).toThrow();
    const copy = structuredClone(snapshot);
    copy.forecasts[0].origin_date = "2026-10-15";
    expect(() => validateSnapshot(copy, "live")).toThrow();
  });
  it("rejects invalid horizon dates and non-finite temperatures", () => {
    const copy = structuredClone(snapshot);
    copy.forecasts[0].target_date = copy.origin_date;
    expect(() => validateSnapshot(copy, "live")).toThrow();
    copy.forecasts[0] = structuredClone(snapshot.forecasts[0]);
    copy.observation.sst_c = NaN;
    expect(() => validateSnapshot(copy, "live")).toThrow();
  });
  it("preserves point forecasts when applying measured intervals and warning rules", () => {
    const overlay = enriched.snapshots.find((s) => s.mode === "live")!;
    const result = mergeReliabilitySnapshot(
      snapshot,
      overlay as Parameters<typeof mergeReliabilitySnapshot>[1],
    );
    expect(result.forecasts.map((f) => f.sst_c)).toEqual(
      snapshot.forecasts.map((f) => f.sst_c),
    );
    expect(result.early_warning?.state).toBe("normal");
    expect(
      result.forecasts.every((f) => f.interval?.test_coverage && f.warning),
    ).toBe(true);
    expect(chartRows(result, 14).at(-1)?.interval).toEqual([
      result.forecasts[2].lower_c,
      result.forecasts[2].upper_c,
    ]);
  });
  it("rejects an overlay from another prediction or invalid intervals", () => {
    const overlay = structuredClone(
      enriched.snapshots.find((s) => s.mode === "live")!,
    ) as Parameters<typeof mergeReliabilitySnapshot>[1];
    overlay.forecasts[0].sst_c += 1;
    expect(() => mergeReliabilitySnapshot(snapshot, overlay)).toThrow();
    const copy = structuredClone(snapshot);
    copy.forecasts[0].upper_c = copy.forecasts[0].sst_c - 1;
    expect(() => validateSnapshot(copy, "live")).toThrow();
    copy.forecasts[0].upper_c = Infinity;
    expect(() => validateSnapshot(copy, "live")).toThrow();
  });
});
