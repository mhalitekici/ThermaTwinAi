import { describe, expect, it } from "vitest";
import report from "../public/reliability-report.json";
import source from "../public/performance-traces-v1.json";
import {
  filterTraces,
  performanceReport,
  summarize,
  validateTraces,
  warmEvents,
} from "./performance";
import type { Reliability, Trace } from "./performance";
const data = validateTraces(source, report as Reliability);
describe("held-out Performance Lab evidence", () => {
  it("reproduces every horizon's versioned metrics and sample counts", () => {
    for (const h of [1, 2, 3]) {
      const m = summarize(data.horizons[h])!;
      const expected = report.rolling_pooled[String(h) as "1"];
      expect(m.n).toBe(expected.n);
      expect(m.scores[0].mae).toBeCloseTo(expected.model.mae_c, 12);
      expect(m.scores[0].rmse).toBeCloseTo(expected.model.rmse_c, 12);
      expect(m.improvement).toBeCloseTo(expected.mae_improvement_pct, 10);
      expect(m.fp).toBe(expected.daily.optimized.fp);
      expect(m.fn).toBe(expected.daily.optimized.fn);
    }
  });
  it.each([
    "duplicate",
    "horizon",
    "calibration",
    "metrics",
    "signal",
    "columns",
  ])("rejects corrupted %s evidence", (kind) => {
    const changed = structuredClone(source);
    const rows = changed.horizons["1"];
    if (kind === "duplicate") rows[1][1] = rows[0][1];
    if (kind === "horizon") rows[0][0] = "2018-12-31";
    if (kind === "calibration") changed.folds[0].calibration_end = "2019-02-01";
    if (kind === "metrics") rows[0][3] = 40;
    if (kind === "signal") rows[0][11] = "true";
    if (kind === "columns") changed.columns.reverse();
    expect(() => validateTraces(changed, report as Reliability)).toThrow();
  });
  it("uses unrounded inclusive tolerance, shared dates and undefined zero denominators", () => {
    const row = data.horizons[1][0];
    const rows: Trace[] = [0.25, 0.2500001, 0.5, 1, 1.00001].map((error, i) => [
      row[0],
      `2019-01-0${i + 2}`,
      20,
      20 + error,
      20,
      20,
      20,
      21,
      22,
      0.5,
      2019,
      false,
    ]);
    const m = summarize(rows)!;
    expect(m.tolerance.map((t) => t.count)).toEqual([1, 3, 4]);
    expect(m.improvement).toBeNull();
    expect(m.f1).toBeNull();
    expect(summarize([])).toBeNull();
  });
  it("filters target year/season and retrospective warming, retaining chronological events", () => {
    const rows = data.horizons[3];
    const filtered = filterTraces(rows, "2025", "JJA", "rising");
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every(
        (r) =>
          r[1].startsWith("2025") &&
          [6, 7, 8].includes(Number(r[1].slice(5, 7))) &&
          r[2] - r[4] >= 0.5,
      ),
    ).toBe(true);
    const events = warmEvents(data.horizons[1]);
    expect(events.length).toBe(
      report.rolling_pooled["1"].events.optimized.events,
    );
    const event = events[0];
    expect(
      filterTraces(
        data.horizons[1],
        "all",
        "all",
        `${event.start}/${event.end}`,
      ),
    ).toHaveLength(event.n);
    expect(filterTraces(rows, "2010", "all", "all")).toEqual([]);
  });
  it("exports exact scope, real metrics and escaped scientific limitations without active resources", () => {
    const changed = structuredClone(report) as Reliability;
    changed.limitations.push('<img src=x onerror="alert(1)">');
    const html = performanceReport(
      changed,
      data,
      1,
      data.horizons[1],
      "<script>unsafe</script>",
    );
    expect(html).toContain("N=2838");
    expect(html).toContain("0,2484");
    expect(html).toContain(data.report_sha256);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|<img|<iframe|<link|https?:\/\//i);
    expect(html).toContain("Tanımlı tolerans");
    expect(() => performanceReport(changed, data, 1, [], "empty")).toThrow();
  });
});
