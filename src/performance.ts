/** Held-out evidence only. All displayed subsets share the same target dates. */
export type Trace = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  boolean,
];
type Score = { mae_c: number; rmse_c: number };
type Counts = {
  n: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
};
export type Evaluation = {
  n: number;
  model: Score;
  persistence: Score;
  seasonal: Score;
  seasonal_naive: Score;
  mae_improvement_pct: number;
  daily: Record<string, Counts>;
  interval: { nominal: number; coverage: number; mean_width_c: number };
  subgroups: Record<string, { n: number; model: Score; coverage: number }>;
};
export type Reliability = {
  version: string;
  created_at: string;
  model_sha256: string;
  source: {
    dataset_id: string;
    dataset_version: string;
    sha256: string;
    first_observation: string;
    last_observation: string;
    valid_days: number;
    missing_days: number;
  };
  rolling_pooled: Record<string, Evaluation>;
  deployed: {
    horizons: Record<
      string,
      { evaluation: Evaluation; old_interval_coverage: number }
    >;
    combined_engine: {
      origins: number;
      events: number;
      detected_events: number;
      early_events: number;
      notifications: number;
      forecast_notifications: number;
      observed_notifications: number;
      suppressed_repeats: number;
      false_event_notifications: number;
      censored_notifications: number;
    };
  };
  limitations: string[];
};
export type Traces = {
  version: string;
  report_version: string;
  evaluated_at: string;
  report_sha256: string;
  model_sha256: string;
  csv_sha256: Record<string, string>;
  columns: string[];
  folds: {
    test_year: number;
    train_end: string;
    validation_end: string;
    calibration_end: string;
    test_end: string;
  }[];
  horizons: Record<string, Trace[]>;
};
const columns = [
  "origin_date",
  "target_date",
  "actual_c",
  "model_c",
  "persistence_c",
  "seasonal_c",
  "seasonal_naive_c",
  "p90_c",
  "p95_c",
  "radius_c",
  "fold",
  "optimized_signal",
];
const iso = /^\d{4}-\d{2}-\d{2}$/;
export function summarize(rows: Trace[]) {
  if (!rows.length) return null;
  const n = rows.length;
  const scores = [3, 4, 5, 6].map((col) => {
    const errors = rows.map((r) => (r[col] as number) - r[2]);
    return {
      mae: errors.reduce((a, e) => a + Math.abs(e), 0) / n,
      rmse: Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / n),
    };
  });
  const errors = rows.map((r) => Math.abs(r[3] - r[2]));
  const tp = rows.filter((r) => r[2] > r[7] && r[11]).length;
  const fp = rows.filter((r) => r[2] <= r[7] && r[11]).length;
  const fn = rows.filter((r) => r[2] > r[7] && !r[11]).length;
  return {
    n,
    start: rows[0][1],
    end: rows.at(-1)![1],
    scores,
    improvement: scores[1].mae
      ? (1 - scores[0].mae / scores[1].mae) * 100
      : null,
    tolerance: [0.25, 0.5, 1].map((limit) => ({
      limit,
      count: errors.filter((e) => e <= limit).length,
      rate: errors.filter((e) => e <= limit).length / n,
    })),
    coverage: rows.filter((r) => Math.abs(r[3] - r[2]) <= r[9]).length / n,
    width: rows.reduce((a, r) => a + 2 * r[9], 0) / n,
    tp,
    fp,
    fn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    f1: 2 * tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null,
  };
}
export function validateTraces(value: unknown, report: Reliability): Traces {
  const data = value as Traces;
  const fail = () => {
    throw new Error("Tahmin izi ile sürümlü değerlendirme eşleşmiyor.");
  };
  if (
    !data ||
    data.version !== "performance-traces-v1" ||
    data.report_version !== report.version ||
    data.model_sha256 !== report.model_sha256 ||
    JSON.stringify(data.columns) !== JSON.stringify(columns) ||
    data.folds?.length !== 8
  )
    fail();
  for (const h of [1, 2, 3]) {
    const rows = data.horizons?.[h];
    if (!Array.isArray(rows) || !rows.length) fail();
    let previous = "";
    for (const r of rows) {
      const f = data.folds.find((f) => f.test_year === r[10]);
      if (
        !Array.isArray(r) ||
        r.length !== 12 ||
        !iso.test(r[0]) ||
        !iso.test(r[1]) ||
        r[1] <= previous ||
        Date.parse(r[1]) - Date.parse(r[0]) !== h * 86400000 ||
        !r
          .slice(2, 11)
          .every((x) => typeof x === "number" && Number.isFinite(x)) ||
        r[9] < 0 ||
        typeof r[11] !== "boolean" ||
        !f ||
        !(
          f.train_end < f.validation_end &&
          f.validation_end < f.calibration_end &&
          f.calibration_end < r[0] &&
          r[1] <= f.test_end
        ) ||
        Number(r[1].slice(0, 4)) !== r[10]
      )
        fail();
      previous = r[1];
    }
    const m = summarize(rows)!;
    const expected = report.rolling_pooled[h];
    if (
      m.n !== expected.n ||
      Math.abs(m.coverage - expected.interval.coverage) > 1e-10
    )
      fail();
    ["model", "persistence", "seasonal", "seasonal_naive"].forEach((key, i) => {
      const score =
        expected[
          key as "model" | "persistence" | "seasonal" | "seasonal_naive"
        ];
      if (
        Math.abs(m.scores[i].mae - score.mae_c) > 1e-10 ||
        Math.abs(m.scores[i].rmse - score.rmse_c) > 1e-10
      )
        fail();
    });
    if (
      m.fp !== expected.daily.optimized.fp ||
      m.fn !== expected.daily.optimized.fn
    )
      fail();
  }
  return data;
}
export const season = (day: string) =>
  [
    "DJF",
    "DJF",
    "MAM",
    "MAM",
    "MAM",
    "JJA",
    "JJA",
    "JJA",
    "SON",
    "SON",
    "SON",
    "DJF",
  ][Number(day.slice(5, 7)) - 1];
export function warmEvents(rows: Trace[]) {
  const result: { start: string; end: string; n: number }[] = [];
  let run: Trace[] = [];
  const flush = () => {
    if (
      run.length >= 5 &&
      rows.some((r) => r[10] === run[0][10] && r[1] < run[0][1]) &&
      rows.some((r) => r[10] === run[0][10] && r[1] > run.at(-1)![1])
    )
      result.push({ start: run[0][1], end: run.at(-1)![1], n: run.length });
    run = [];
  };
  for (const r of rows) {
    if (
      run.length &&
      (r[10] !== run[0][10] ||
        Date.parse(r[1]) - Date.parse(run.at(-1)![1]) !== 86400000)
    )
      flush();
    if (r[2] > r[7]) run.push(r);
    else flush();
  }
  flush();
  return result;
}
export function filterTraces(
  rows: Trace[],
  year: string,
  selectedSeason: string,
  event: string,
) {
  return rows.filter(
    (r) =>
      (year === "all" || r[1].startsWith(year)) &&
      (selectedSeason === "all" || season(r[1]) === selectedSeason) &&
      (event === "all" ||
        (event === "rising"
          ? r[2] - r[4] >= 0.5
          : event === "warm"
            ? r[2] > r[7]
            : r[1] >= event.split("/")[0] && r[1] <= event.split("/")[1])),
  );
}
export function escapeHtml(value: unknown) {
  return String(value).replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
}
export function performanceReport(
  report: Reliability,
  traces: Traces,
  h: number,
  rows: Trace[],
  scope: string,
) {
  const m = summarize(rows);
  if (!m) throw new Error("Boş kapsam için rapor oluşturulamaz.");
  const e = escapeHtml;
  const fmt = (n: number | null) =>
    n === null
      ? "Tanımsız"
      : n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ThermaTwin AI Performance Lab</title><style>body{font:16px/1.6 system-ui;color:#102737;max-width:1100px;margin:40px auto;padding:24px}h1,h2{color:#086a77}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:8px;border-bottom:1px solid #b2c7cc;text-align:left}code{overflow-wrap:anywhere}.notice{padding:16px;border:1px solid #9a5c15;background:#fff8ed}@media print{body{margin:0;padding:0}thead{display:table-header-group}tr{break-inside:avoid}button{display:none}}</style><body><h1>ThermaTwin AI Performance Lab</h1><p>ThermaTwin Forecasting Engine · XGBoost + persistence</p><p>Sürüm: ${e(traces.version)} / ${e(report.version)} · Değerlendirme: ${e(report.created_at)} · +${h * 24} saat</p><p>Kapsam: ${e(scope)} · ${e(m.start)} — ${e(m.end)} · N=${m.n}</p><p class="notice">Geçmişe dönük değerlendirme. Önceki test incelenmiştir; bağımsız gelecek deneyi değildir. Tolerans oranı genel “AI doğruluğu” değildir. Gerçek e-posta gönderimi veya model terfisi yapılmaz.</p><h2>Aynı hedef günlerindeki sıcaklık hataları</h2><table><thead><tr><th>Yöntem</th><th>MAE °C</th><th>RMSE °C</th></tr></thead><tbody>${m.scores.map((s, i) => `<tr><th>${["Model", "Persistence", "Mevsimsel referans", "Önceki yıl"][i]}</th><td>${fmt(s.mae)}</td><td>${fmt(s.rmse)}</td></tr>`).join("")}</tbody></table><p>Persistence'a göre MAE değişimi: %${fmt(m.improvement)}</p><h2>Tanımlı tolerans ve belirsizlik</h2><ul>${m.tolerance.map((t) => `<li>±${t.limit} °C içinde: ${t.count}/${m.n} (%${fmt(t.rate * 100)})</li>`).join("")}</ul><p>|Tahmin − gözlem| ≤ tolerans; yuvarlanmamış değerler. Nominal %80 aralığın kapsaması: %${fmt(m.coverage * 100)}; ortalama tam genişlik ${fmt(m.width)} °C.</p><p>Validation'da seçilen P90 kuralı: Precision ${fmt(m.precision)}, Recall ${fmt(m.recall)}, F1 ${fmt(m.f1)}, TP ${m.tp}, FP ${m.fp}, FN ${m.fn}. Bu filtre günlük ölçümdür; olay lead time hesabı değildir.</p><h2>Kaynak ve tekrar üretim</h2><p>${e(report.source.dataset_id)} / ${e(report.source.dataset_version)} · Akkuyu açık deniz ROI günlük cos(latitude) ağırlıklı ortalama. Hedef: başlangıçtan ${h} gün sonraki analysed_sst.</p><p>Yıllık genişleyen eğitim → ayrı validation yılı → ayrı kalibrasyon yılı → test; sınırı aşan hedefler çıkarılır. Yalnız geçmiş SST gecikmeleri/ortalama/oynaklık/trend ve takvim özellikleri. %80 kalibrasyon ayrı geçmiş kalibrasyon bloğundandır.</p><p>Model SHA-256: <code>${e(report.model_sha256)}</code><br>Veri SHA-256: <code>${e(report.source.sha256)}</code><br>Rapor SHA-256: <code>${e(traces.report_sha256)}</code><br>CSV SHA-256: <code>${e(traces.csv_sha256[h])}</code></p><h2>Sınırlar</h2><ul>${report.limitations.map((x) => `<li>${e(x)}</li>`).join("")}</ul><p>Mevcut deployed strateji uyarı F1'ında persistence'ı geçmez. Hızlı ısınma koşullu kapsaması düşüktür. Geçmiş arşiv revizyonu/gerçek yayın gecikmesi modellenmedi; anlık sensör veya tesis etkisi ölçümü değildir.</p><h2>Tüm seçili hedef günleri</h2><table><thead><tr><th>Başlangıç</th><th>Hedef</th><th>Gözlem °C</th><th>Tahmin °C</th><th>Persistence °C</th><th>Alt / üst °C</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${fmt(r[2])}</td><td>${fmt(r[3])}</td><td>${fmt(r[4])}</td><td>${fmt(r[3] - r[9])} / ${fmt(r[3] + r[9])}</td></tr>`).join("")}</tbody></table><p>Tarayıcının Yazdır → PDF olarak kaydet seçeneğiyle dışa aktarılabilir. Hiçbir dış kaynak veya izleyici içermez.</p></body></html>`;
}
