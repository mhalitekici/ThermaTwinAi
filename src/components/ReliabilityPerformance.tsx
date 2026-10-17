import { useEffect, useState } from "react";
import { temp } from "../lib";
type Counts = {
  precision: number;
  recall: number;
  f1: number;
  fp: number;
  fn: number;
  n: number;
};
type EventMetric = {
  events: number;
  detected_events: number;
  early_events: number;
  notifications: number;
  suppressed_repeats: number;
  false_notifications: number;
  precision: number;
  recall: number;
  f1: number;
};
type Evaluation = {
  n: number;
  model: { mae_c: number; rmse_c: number };
  persistence: { mae_c: number };
  seasonal: { mae_c: number };
  seasonal_naive: { mae_c: number };
  mae_improvement_pct: number;
  daily: Record<string, Counts>;
  events: Record<string, EventMetric>;
  interval: { coverage: number; mean_width_c: number };
  subgroups: Record<string, { n: number; coverage: number }>;
};
type Reliability = {
  rolling_pooled: Record<string, Evaluation>;
  deployed: {
    combined_engine: {
      events: number;
      detected_events: number;
      early_events: number;
      notifications: number;
      forecast_notifications: number;
      observed_notifications: number;
      suppressed_repeats: number;
      false_event_notifications: number;
    };
    horizons: Record<
      string,
      {
        evaluation: Evaluation;
        old_interval_coverage: number;
        warning_policy: {
          source: string;
          percentile: number;
          margin_c: number;
        };
      }
    >;
  };
  checks: { rolling_folds: number };
  limitations: string[];
};
export default function ReliabilityPerformance() {
  const [data, setData] = useState<Reliability | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/reliability-report.json")
      .then((r) => {
        if (!r.ok) throw new Error("Güvenilirlik raporu yüklenemedi.");
        return r.json();
      })
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (error)
    return (
      <div className="notice error" role="alert">
        {error}
      </div>
    );
  if (!data) return <p role="status">Güvenilirlik ölçümleri yükleniyor…</p>;
  return (
    <div className="reliability-results">
      <section className="panel settings-card">
        <h2>Rolling-origin · 2019–2026</h2>
        <p>
          {data.checks.rolling_folds} yıllık değerlendirme. Her yıl genişleyen
          eğitim, ayrı validation ve kalibrasyon; her gün yeni tahmin
          başlangıcı. Son yıl 16 Ekim 2026’da biter. Bunlar geçmişe dönük
          ölçümlerdir.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Rolling-origin sıcaklık hataları
            </caption>
            <thead>
              <tr>
                <th scope="col">Ufuk</th>
                <th scope="col">MAE / RMSE °C</th>
                <th scope="col">Persistence MAE</th>
                <th scope="col">Mevsimsel ortalama MAE</th>
                <th scope="col">Önceki yıl MAE</th>
                <th scope="col">MAE iyileşmesi</th>
                <th scope="col">Aralık kapsaması</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.rolling_pooled).map(([h, m]) => (
                <tr key={h}>
                  <th scope="row">+{Number(h) * 24} saat</th>
                  <td>
                    {temp(m.model.mae_c, 3)} / {temp(m.model.rmse_c, 3)}
                  </td>
                  <td>{temp(m.persistence.mae_c, 3)}</td>
                  <td>{temp(m.seasonal.mae_c, 3)}</td>
                  <td>{temp(m.seasonal_naive.mae_c, 3)}</td>
                  <td>%{temp(m.mae_improvement_pct)}</td>
                  <td>%{temp(m.interval.coverage * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Fold kuralları validation’da seçildi. Sonuç yüzdelerinin ortalaması
          yerine günlük hatalar ve karışıklık sayıları birleştirildi.
        </p>
      </section>
      <section className="panel settings-card">
        <h2>Yeni uyarı politikası · mevcut modelin ayrı testi</h2>
        <p>
          23 Aralık 2023–16 Ekim 2026 başlangıçları; ufka göre 1.026–1.028
          eşleşme. Gerçek etiket daima gözlenmiş P90 aşımıdır. P95 tetik
          adayları bu etiketi değiştirmez. Aşağıdaki yanlış alarm sayısı günlük
          sinyal sayısıdır.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Validation ile seçilen günlük uyarı başarısı
            </caption>
            <thead>
              <tr>
                <th scope="col">Ufuk</th>
                <th scope="col">Precision</th>
                <th scope="col">Recall</th>
                <th scope="col">Yeni F1</th>
                <th scope="col">Eski model F1</th>
                <th scope="col">Persistence F1</th>
                <th scope="col">Yanlış alarm (FP)</th>
                <th scope="col">Kaçırılan gün (FN)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.deployed.horizons).map(([h, item]) => {
                const d = item.evaluation.daily;
                return (
                  <tr key={h}>
                    <th scope="row">+{Number(h) * 24} saat</th>
                    <td>{temp(d.optimized.precision, 3)}</td>
                    <td>{temp(d.optimized.recall, 3)}</td>
                    <td>{temp(d.optimized.f1, 3)}</td>
                    <td>{temp(d.old_model_p90.f1, 3)}</td>
                    <td>{temp(d.persistence_p90.f1, 3)}</td>
                    <td>{d.optimized.fp}</td>
                    <td>{d.optimized.fn}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          Yeni politika üç ufukta da persistence F1 skorunun altında. +72 saatte
          önceki XGBoost kuralının da altında. Bu nedenle bağımsız otomatik
          erken uyarı için hazır kabul edilmez.
        </p>
      </section>
      <section className="panel settings-card">
        <h2>Aralık kalibrasyonu · hedef %80</h2>
        <p>
          Ayrı kalibrasyon residual’ları; her ufuk ayrı. En az 60 örnek varsa
          mevsimsel ve genel yarıçapın büyüğü kullanılır. Bu kural test
          kapsamasına göre seçilmedi.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Tahmin aralığı kapsaması ve hızlı yükselişlerde sınırı
            </caption>
            <thead>
              <tr>
                <th scope="col">Ufuk</th>
                <th scope="col">Eski kapsama</th>
                <th scope="col">Yeni kapsama</th>
                <th scope="col">Ortalama genişlik °C</th>
                <th scope="col">En düşük mevsim kapsaması</th>
                <th scope="col">Hızlı ısınma kapsaması</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.deployed.horizons).map(([h, item]) => {
                const m = item.evaluation;
                const minimum = Math.min(
                  ...["DJF", "MAM", "JJA", "SON"].map(
                    (s) => m.subgroups[s].coverage,
                  ),
                );
                return (
                  <tr key={h}>
                    <th scope="row">+{Number(h) * 24} saat</th>
                    <td>%{temp(item.old_interval_coverage * 100)}</td>
                    <td>%{temp(m.interval.coverage * 100)}</td>
                    <td>{temp(m.interval.mean_width_c, 2)}</td>
                    <td>%{temp(minimum * 100)}</td>
                    <td>%{temp(m.subgroups.rising.coverage * 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          Hızlı ısınma: hedef gözlemin başlangıca göre en az 0,5 °C yükseldiği
          günler. Bu alt grupta kapsama çok daha zayıf; toplam kapsama olay
          öncesi güvenilirlik anlamına gelmez.
        </p>
      </section>
      <section className="panel settings-card">
        <h2>Olaylar ve tekrar uyarıları</h2>
        <p>
          Dashboard’daki birleşik motorun tüm testteki provası:{" "}
          {data.deployed.combined_engine.notifications} kayıt (
          {data.deployed.combined_engine.forecast_notifications} öngörü,{" "}
          {data.deployed.combined_engine.observed_notifications} gözlem),{" "}
          {data.deployed.combined_engine.suppressed_repeats} bastırılan tekrar.{" "}
          {data.deployed.combined_engine.events} olayın{" "}
          {data.deployed.combined_engine.detected_events} tanesi saptandı;
          yalnız {data.deployed.combined_engine.early_events} tanesi başlamadan
          yakalandı. {data.deployed.combined_engine.false_event_notifications}{" "}
          kayıt beş günlük bir olaya denk gelmedi.
        </p>
        <p>
          En az beş ardışık gözlenmiş P90 günü bir olaydır. Test sınırına değen
          seriler değerlendirme dışında tutulur. Aşağıdaki sayılar her ufuk için
          ayrı sinyal provasıdır; kullanıcıya gönderilmiş e-posta değildir.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Olay bazlı uyarı ve tekrar azaltımı
            </caption>
            <thead>
              <tr>
                <th scope="col">Ufuk</th>
                <th scope="col">Yakalanan / olay</th>
                <th scope="col">Başlamadan yakalanan</th>
                <th scope="col">Olay F1</th>
                <th scope="col">Bildirim provası</th>
                <th scope="col">Bastırılan tekrar</th>
                <th scope="col">5 günlük olaya denk gelmeyen</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.deployed.horizons).map(([h, item]) => {
                const m = item.evaluation.events.optimized;
                return (
                  <tr key={h}>
                    <th scope="row">+{Number(h) * 24} saat</th>
                    <td>
                      {m.detected_events} / {m.events}
                    </td>
                    <td>{m.early_events}</td>
                    <td>{temp(m.f1, 3)}</td>
                    <td>{m.notifications}</td>
                    <td>{m.suppressed_repeats}</td>
                    <td>{m.false_notifications}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          Başlangıçta bir kayıt; iki normal gün sonra yeniden kurulum. Dashboard
          motoru, ayrıca öngörülen risk gözlemsel anomaliye geçtiğinde bir teyit
          kaydı üretir. Kısa sıcak ataklar günlük doğru sinyal olup beş günlük
          olay değerlendirmesinde yanlış sayılabilir.
        </p>
        <a className="text-link" href="/reliability-report.json" download>
          Tüm yılları, mevsimleri ve P90/P95 karşılaştırmasını indir
        </a>
        <ul className="limitations">
          {data.limitations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
