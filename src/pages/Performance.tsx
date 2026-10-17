import { useEffect, useMemo, useState } from "react";
import { Download, FlaskConical, RefreshCw } from "lucide-react";
import { Badge, PageHead } from "../components/common";
import HeldOutChart from "../components/HeldOutChart";
import ReliabilityPerformance from "../components/ReliabilityPerformance";
import { date, temp } from "../lib";
import {
  filterTraces,
  performanceReport,
  summarize,
  validateTraces,
  warmEvents,
} from "../performance";
import type { Reliability, Traces } from "../performance";
import "./performance.css";
type Evidence = {
  report: Reliability;
  traces: Traces;
  audit: { checks: Record<string, unknown> };
};
const number = (n: number | null, digits = 3) =>
  n === null ? "Tanımsız" : temp(n, digits);

export default function Performance() {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [h, setH] = useState(1),
    [year, setYear] = useState("all"),
    [season, setSeason] = useState("all"),
    [event, setEvent] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    const read = async (path: string) => {
      const r = await fetch(path, { signal: controller.signal });
      if (!r.ok) throw new Error("Değerlendirme kaynağı yüklenemedi.");
      return r.text();
    };
    Promise.all([
      read("/reliability-report.json"),
      read("/performance-traces-v1.json"),
      read("/model-audit.json"),
    ])
      .then(async ([reportText, traceText, auditText]) => {
        const report = JSON.parse(reportText) as Reliability;
        const traces = validateTraces(JSON.parse(traceText), report);
        const digest = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(reportText.replace(/\r\n/g, "\n")),
            ),
          ),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (digest !== traces.report_sha256)
          throw new Error("Değerlendirme kaynak hash'i eşleşmiyor.");
        if (!controller.signal.aborted) {
          setEvidence({ report, traces, audit: JSON.parse(auditText) });
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Kaynak doğrulanamadı.");
      });
    return () => controller.abort();
  }, [attempt]);
  const rows = useMemo(
    () =>
      evidence
        ? filterTraces(evidence.traces.horizons[h], year, season, event)
        : [],
    [evidence, h, year, season, event],
  );
  const metrics = useMemo(() => summarize(rows), [rows]);
  const events = useMemo(
    () => (evidence ? warmEvents(evidence.traces.horizons[h]) : []),
    [evidence, h],
  );
  const scope = `Yıl: ${year} · mevsim: ${season} · olay: ${event}`;
  function download() {
    if (!evidence || !metrics) return;
    const url = URL.createObjectURL(
      new Blob(
        [performanceReport(evidence.report, evidence.traces, h, rows, scope)],
        { type: "text/html;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `thermatwin-performance-${h * 24}h-${evidence.traces.version}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageHead
        eyebrow="THERMATWIN AI PERFORMANCE LAB"
        title="Tahmini ölçün. Sınırlarını görün."
        description="ThermaTwin Forecasting Engine · XGBoost ile persistence harmanı. Gerçek test tahminleri, aynı günlerdeki baselines ve açık bilimsel sınırlar."
      />
      {error ? (
        <div className="notice error" role="alert">
          <p>{error} Doğrulanmayan ölçümler gösterilmez.</p>
          <button
            className="btn"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            <RefreshCw size={16} /> Yeniden dene
          </button>
        </div>
      ) : !evidence ? (
        <div className="panel settings-card" role="status">
          Sürümlü rapor ve gerçek test izleri doğrulanıyor…
        </div>
      ) : (
        <div className="reliability-results">
          <section className="panel settings-card lab-overview">
            <div className="panel-head">
              <div>
                <p className="eyebrow">
                  <FlaskConical size={16} /> ÖLÇÜLMÜŞ SONUÇLAR
                </p>
                <h2>Rolling-origin · 2019–2026</h2>
                <p>
                  {evidence.report.version} · Değerlendirme{" "}
                  {date(evidence.report.created_at)} · 8 yıllık test
                </p>
              </div>
              <Badge color="teal">GEÇMİŞ TEST</Badge>
            </div>
            <div className="lab-summary-grid">
              {[1, 2, 3].map((horizon) => {
                const m = evidence.report.rolling_pooled[horizon];
                return (
                  <button
                    className={`lab-kpi ${h === horizon ? "selected" : ""}`}
                    aria-pressed={h === horizon}
                    key={horizon}
                    onClick={() => setH(horizon)}
                  >
                    <span>+{horizon * 24} saat · MAE</span>
                    <strong>
                      {temp(m.model.mae_c, 4)} <small>°C</small>
                    </strong>
                    <span>
                      Persistence'a göre %{temp(m.mae_improvement_pct, 2)} daha
                      düşük
                    </span>
                    <small>
                      N={m.n} · RMSE {temp(m.model.rmse_c, 4)} °C
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="table-note">
              Yukarıdaki kartlar tüm rolling-origin dönemini gösterir. Aşağıdaki
              grafik ve ölçümler seçili ufuk/filtreyle eşzamanlıdır. Bu bir
              genel “AI doğruluk yüzdesi” değildir.
            </p>
          </section>
          <section
            className="panel settings-card lab-explorer"
            aria-label="Geçmiş performans gezgini"
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">KAYIT DÜZEYİNDE KANIT</p>
                <h2>+{h * 24} saatlik tahminleri inceleyin</h2>
              </div>
              <button className="btn" disabled={!metrics} onClick={download}>
                <Download size={16} /> Bilimsel HTML raporu
              </button>
            </div>
            <div className="lab-filters">
              <label>
                Hedef yılı
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="all">Tüm yıllar</option>
                  {evidence.traces.folds.map((f) => (
                    <option key={f.test_year}>{f.test_year}</option>
                  ))}
                </select>
              </label>
              <label>
                Hedef mevsimi
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                >
                  <option value="all">Tüm mevsimler</option>
                  {[
                    ["DJF", "Kış · Ara/Oca/Şub"],
                    ["MAM", "İlkbahar · Mar/Nis/May"],
                    ["JJA", "Yaz · Haz/Tem/Ağu"],
                    ["SON", "Sonbahar · Eyl/Eki/Kas"],
                  ].map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Olay / alt grup
                <select
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                >
                  <option value="all">Tüm koşullar</option>
                  <option value="rising">Hızlı ≥0,5 °C ısınma</option>
                  <option value="warm">Gözlenen P90 sıcak gün</option>
                  {events.map((e) => (
                    <option key={e.start} value={`${e.start}/${e.end}`}>
                      {e.start} — {e.end} · {e.n} gün
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setYear("all");
                  setSeason("all");
                  setEvent("all");
                }}
              >
                Filtreleri sıfırla
              </button>
            </div>
            <p className="table-note">
              Mevsim ve olay filtreleri hedef gününe göre seçilir. ≥5 ardışık
              P90 günü olay sayılır; fold sınırına değen olaylar dışlanır.
              Bunlar sonradan bilinen alt gruplardır; gerçek zamanda seçim veya
              yeni lead time testi değildir.
            </p>
            {!metrics ? (
              <p role="status" className="notice">
                Bu filtrelerde eşleşen gerçek test kaydı yok. Filtreleri
                sıfırlayın.
              </p>
            ) : (
              <>
                <p className="lab-scope" role="status" data-testid="lab-scope">
                  +{h * 24} saat · N={metrics.n} · {date(metrics.start)} —{" "}
                  {date(metrics.end)}
                </p>
                <HeldOutChart rows={rows} />
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Performans tablosu"
                >
                  <table className="lab-baselines">
                    <caption>
                      Aynı {metrics.n} hedef gününde sıcaklık tahmini
                      karşılaştırması · düşük hata daha iyi
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Yöntem</th>
                        <th scope="col">MAE °C</th>
                        <th scope="col">RMSE °C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.scores.map((m, i) => (
                        <tr key={i}>
                          <th scope="row">
                            {
                              [
                                "ThermaTwin Forecasting Engine",
                                "Persistence · son gözlem",
                                "Mevsimsel eğitim referansı",
                                "Önceki yıl · seasonal naive",
                              ][i]
                            }
                          </th>
                          <td>{number(m.mae, 4)}</td>
                          <td>{number(m.rmse, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Seçili kapsamda persistence'a göre MAE değişimi:{" "}
                  <strong>%{number(metrics.improvement, 2)}</strong>. Negatif
                  değer modelin daha kötü olduğunu gösterir. MAE: ortalama
                  mutlak hata; RMSE büyük hataları daha çok ağırlıklandırır.
                </p>
                <div className="lab-summary-grid">
                  {metrics.tolerance.map((t) => (
                    <article key={t.limit}>
                      <span>±{temp(t.limit, 2)} °C tolerans içinde</span>
                      <strong>%{temp(t.rate * 100, 2)}</strong>
                      <p>
                        {t.count} / {metrics.n} tahmin · |tahmin − gözlem| ≤{" "}
                        {temp(t.limit, 2)} °C
                      </p>
                    </article>
                  ))}
                </div>
                <p>
                  Oranlar yuvarlanmamış held-out kayıtlardan hesaplanır; dönem
                  ve ufuk yukarıdaki kapsamla aynıdır. Genel model doğruluğu
                  veya olay olasılığı değildir.
                </p>
                <div className="lab-summary-grid">
                  <article>
                    <span>Nominal %80 aralık</span>
                    <strong>%{temp(metrics.coverage * 100, 2)}</strong>
                    <p>
                      Gözlenen kapsama · tam genişlik {temp(metrics.width, 3)}{" "}
                      °C. Koşullu garanti değildir.
                    </p>
                  </article>
                  <article>
                    <span>Seçili kapsam · günlük P90 kuralı</span>
                    <strong>F1 {number(metrics.f1)}</strong>
                    <p>
                      Precision {number(metrics.precision)} · Recall{" "}
                      {number(metrics.recall)}. Payda sıfırsa “Tanımsız”.
                    </p>
                  </article>
                  <article>
                    <span>Validation'da seçilen kural</span>
                    <strong>
                      FP {metrics.fp} / FN {metrics.fn}
                    </strong>
                    <p>
                      TP {metrics.tp} · kural her fold'un validation verisinde
                      seçildi. Günlük hata, olay tespiti değildir.
                    </p>
                  </article>
                </div>
              </>
            )}
          </section>
          <ReliabilityPerformance data={evidence.report} horizon={h} />
          <section className="panel settings-card lab-method">
            <p className="eyebrow">MODEL KARTI VE TEKRAR ÜRETİM</p>
            <h2>Veriden sonuca açık bir zincir.</h2>
            <p>
              Hedef: günlük başlangıçtan 1/2/3 gün sonraki Akkuyu açık-deniz ROI
              ortalama SST. {evidence.report.source.dataset_id}, sürüm{" "}
              {evidence.report.source.dataset_version}; analysed_sst, yaklaşık 1
              km L4 uydu analizi. Anlık saha sensörü değildir.
            </p>
            <p>
              Özellikler: geçmiş SST gecikmeleri (1/2/3/7/14 gün), 3/7/14 gün
              ortalamalar, 7 gün oynaklık, 3/7 gün trend ve döngüsel takvim.
              XGBoost ile persistence ağırlığı validation MAE ile seçilir.
              Referans yalnız eğitim bloğundan; ayrı kalibrasyon bloğu nominal
              %80 mevsimsel aralık üretir.
            </p>
            <details>
              <summary>Sekiz fold'un kronolojik sınırları</summary>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Performans tablosu"
              >
                <table>
                  <caption>Hedefi blok dışına taşan örnekler çıkarılır</caption>
                  <thead>
                    <tr>
                      <th>Test yılı</th>
                      <th>Eğitim sonu</th>
                      <th>Validation sonu</th>
                      <th>Kalibrasyon sonu</th>
                      <th>Test sonu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.traces.folds.map((f) => (
                      <tr key={f.test_year}>
                        <th scope="row">{f.test_year}</th>
                        <td>{f.train_end}</td>
                        <td>{f.validation_end}</td>
                        <td>{f.calibration_end}</td>
                        <td>{f.test_end}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <ul className="audit-checks">
              {[
                ["chronological_split", "Kronolojik ayrım"],
                ["future_independence", "Gelecekten bağımsız özellik"],
                ["frozen_climatology", "Eğitimde dondurulmuş referans"],
                ["model_preserved", "Özgün model koruması"],
              ].map(([key, label]) => (
                <li key={key}>
                  {label}
                  <span>
                    {evidence.audit.checks[key] === true
                      ? "Doğrulandı"
                      : "Doğrulanamadı"}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              {evidence.traces.version} · {evidence.report.version} ·
              değerlendirme {date(evidence.report.created_at)}.{" "}
              {evidence.report.source.first_observation}–
              {evidence.report.source.last_observation}:{" "}
              {evidence.report.source.valid_days} geçerli /{" "}
              {evidence.report.source.missing_days} eksik gün.
            </p>
            <p className="lab-hash">
              Sabit deployed model SHA-256{" "}
              <code>{evidence.report.model_sha256}</code>
              <br />
              Rolling fold modelleri yıllık ayrı fit edilir; bu hash onların
              ortak modeli değildir. Rapor SHA-256{" "}
              <code>{evidence.traces.report_sha256}</code>
            </p>
            <details>
              <summary>Bilimsel sınırların tamamı</summary>
              <ul className="limitations">
                {evidence.report.limitations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
            <p className="notice warning">
              Önceki sabit test incelenmiştir; bu değerlendirme bağımsız gelecek
              deneyi değildir. Arşiv revizyonları ve gerçek yayın gecikmesi
              modellenmez. Referans standart 30 yıllık klimatoloji değildir;
              nedensel tesis etkisi veya ekolojik zarar kanıtı sunulmaz.
            </p>
            <div className="lab-downloads">
              <a
                className="text-link"
                href="/performance-traces-v1.json"
                download
              >
                Tüm doğrulanmış test izleri (JSON)
              </a>
              <a className="text-link" href="/reliability-report.json" download>
                Orijinal sürümlü rapor (JSON)
              </a>
              <a className="text-link" href="/model-audit.json" download>
                Sayısal model denetimi (JSON)
              </a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
