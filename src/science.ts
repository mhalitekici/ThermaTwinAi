import type { Risk, Snapshot } from "./lib";
export function observationAge(snap: Snapshot, now = Date.now()) {
  return Math.max(
    0,
    Math.floor((now - Date.parse(snap.origin_date + "T00:00:00Z")) / 86400000),
  );
}
export function isStale(snap: Snapshot, now = Date.now()) {
  return snap.mode === "live" && (snap.stale || observationAge(snap, now) > 3);
}
export function riskDetail(value: {
  sst_c: number;
  reference_c: number;
  p90_c: number;
  risk: Risk;
}) {
  const difference = value.sst_c - value.reference_c,
    exceed = value.sst_c - value.p90_c;
  return {
    difference,
    exceed,
    threshold: value.p90_c,
    meaning:
      exceed > 0 ? "Sıcak gün eşiği aşılıyor." : "Sıcak gün eşiği aşılmıyor.",
    action:
      value.risk === "high"
        ? "Bir sonraki uydu analizi ve bağımsız saha ölçümleriyle kontrol önerilir."
        : value.risk === "watch"
          ? "Sonraki günlük gözlemde değişimin sürüp sürmediği izlenmeli."
          : "Mevcut veriye göre ek inceleme sinyali yok.",
  };
}
export interface ChartRow {
  date: string;
  time: number;
  actual: number | null;
  predicted: number | null;
  reference: number;
  threshold: number;
  anomaly: number | null;
  predictedAnomaly: number | null;
  interval: [number, number] | null;
  anomalyPoint: number | null;
}
export function chartRows(
  snap: Snapshot,
  days: number,
  includeForecast = true,
): ChartRow[] {
  const history = snap.history
    .filter((r) => r.date <= snap.origin_date)
    .slice(-days);
  const rows: ChartRow[] = history.map((r) => ({
    date: r.date,
    time: Date.parse(r.date),
    actual: r.sst_c,
    predicted: r.date === snap.origin_date && includeForecast ? r.sst_c : null,
    reference: r.reference_c,
    threshold: r.p90_c,
    anomaly: r.anomaly_c,
    predictedAnomaly:
      r.date === snap.origin_date && includeForecast ? r.anomaly_c : null,
    interval: null,
    anomalyPoint: r.sst_c !== null && r.sst_c > r.p90_c ? r.sst_c : null,
  }));
  if (includeForecast)
    for (const f of snap.forecasts) {
      rows.push({
        date: f.target_date,
        time: Date.parse(f.target_date),
        actual: null,
        predicted: f.sst_c,
        reference: f.reference_c,
        threshold: f.p90_c,
        anomaly: null,
        predictedAnomaly: f.sst_c - f.reference_c,
        interval: [f.lower_c, f.upper_c],
        anomalyPoint: null,
      });
    }
  return rows;
}
