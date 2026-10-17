import { temp } from "../lib";
import type { Reliability } from "../performance";

/** Frozen deployed strategy diagnostics: never mixed with explorer subsets. */
export default function ReliabilityPerformance({
  data,
  horizon,
}: {
  data: Reliability;
  horizon: number;
}) {
  const m = data.deployed.horizons[horizon].evaluation;
  const engine = data.deployed.combined_engine;
  return (
    <section className="panel settings-card lab-diagnostics">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AYRI PROTOKOL · SABİT DEPLOYED MODEL</p>
          <h2>Uyarı başarısı sıcaklık hatasından farklıdır.</h2>
          <p>
            +{horizon * 24} saat · N={m.n} · 2023 sonu–16 Ekim 2026. Üstteki
            rolling/filtreli ölçümler bu bölümü değiştirmez.
          </p>
        </div>
      </div>
      <div className="notice warning">
        <strong>Uyarı F1 skoru persistence'ı geçmiyor.</strong>
        <span>
          Erken uyarı ve hızlı ısınma kapsaması sınırlı; gerçek zamanlı koruma
          garantisi verilmez.
        </span>
      </div>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Uyari tani tablosu"
      >
        <table>
          <caption>
            P90 sıcak gün sınıflaması · testte validation seçimi değiştirilmez
          </caption>
          <thead>
            <tr>
              <th scope="col">Kural</th>
              <th scope="col">Precision</th>
              <th scope="col">Recall</th>
              <th scope="col">F1</th>
              <th scope="col">FP / FN</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["optimized", "Validation seçimi"],
              ["old_model_p90", "Model > P90"],
              ["persistence_p90", "Persistence > P90"],
            ].map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{temp(m.daily[key].precision, 3)}</td>
                <td>{temp(m.daily[key].recall, 3)}</td>
                <td>{temp(m.daily[key].f1, 3)}</td>
                <td>
                  {m.daily[key].fp} / {m.daily[key].fn}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lab-summary-grid">
        <article>
          <span>
            Birleşik motor · {engine.origins.toLocaleString("tr-TR")} başlangıç
          </span>
          <strong>
            {engine.early_events} / {engine.events}
          </strong>
          <p>
            Olay başlangıcından önce yakalanan / uygun olay. Toplam{" "}
            {engine.detected_events} olay yakalandı.
          </p>
        </article>
        <article>
          <span>Geçmiş simülasyon</span>
          <strong>{engine.notifications} kayıt</strong>
          <p>
            {engine.forecast_notifications} tahmin,{" "}
            {engine.observed_notifications} gözlem; {engine.suppressed_repeats}{" "}
            tekrar bastırıldı. Gerçek gönderim sayısı değildir.
          </p>
        </article>
        <article>
          <span>Yanlış olay bildirimi</span>
          <strong>{engine.false_event_notifications}</strong>
          <p>
            {engine.censored_notifications} sınırda sansürlü kayıt. Günlük FP
            ile aynı ölçüt değildir.
          </p>
        </article>
      </div>
      <h3>Belirsizlikte koşullu zayıflık</h3>
      <p>
        Nominal %{temp(m.interval.nominal * 100, 0)} aralığın toplam kapsaması %
        {temp(m.interval.coverage * 100)}, tam genişliği{" "}
        {temp(m.interval.mean_width_c, 3)} °C. Hızlı ≥0,5 °C ısınmada kapsama{" "}
        <strong>%{temp(m.subgroups.rising.coverage * 100)}</strong> (N=
        {m.subgroups.rising.n}), MAE {temp(m.subgroups.rising.model.mae_c, 3)}{" "}
        °C.
      </p>
      <p>
        Olay: en az beş ardışık P90 günü; sınır olayları dışlanır. Bir olayda
        tekrar bastırma ve iki açık günle yeniden kurulma uygulanır. Lead time:
        tahminin üretildiği gün ile olayın ilk günü arasındaki fark; bu rapor
        yeni ortalama lead time üretmez.
      </p>
      <p className="table-note">
        Eski aralık kalibrasyonunun +72 saat kapsaması %
        {temp(data.deployed.horizons[3].old_interval_coverage * 100, 1)} idi;
        yukarıdaki değerler ayrı kalibrasyon politikasına aittir. Kapsam ve
        sürüm farkı korunur.
      </p>
    </section>
  );
}
