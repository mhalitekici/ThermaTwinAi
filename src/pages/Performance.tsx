import { useEffect, useState } from "react";
import { Check, CheckCircle2, TriangleAlert } from "lucide-react";
import { useApp } from "../context";
import { date, temp } from "../lib";
import { Badge, PageHead, SourceFootnote } from "../components/common";
import ReliabilityPerformance from "../components/ReliabilityPerformance";
type Audit = {
  audited_at: string;
  model_sha256: string;
  checks: Record<string, string | boolean | number>;
  limitations: string[];
  horizons: Record<
    string,
    {
      mae_improvement_pct: number;
      persistence_warm_f1: number;
      worst_errors: { target_date: string; error: number }[];
      year_metrics: Record<string, { mae_c: number; rmse_c: number }>;
    }
  >;
};
export default function Performance() {
  const { snap } = useApp();
  const [audit, setAudit] = useState<Audit | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/model-audit.json")
      .then((r) => {
        if (!r.ok) throw new Error("Denetim raporu yüklenemedi.");
        return r.json();
      })
      .then((data) => {
        if (alive) setAudit(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const metrics = snap?.evaluation.horizons;
  return (
    <>
      <PageHead
        eyebrow="MODEL PERFORMANSI"
        title="Tahminin arkasındaki gerçek sonuçlar."
        description="Başarıyı bir yüzdeyle özetlemiyoruz. Ayrılmış gerçek test verisindeki hatayı ve sınırlarını gösteriyoruz."
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="notice">
        <CheckCircle2 size={21} />
        <div>
          <strong>Model yeniden eğitilmeden denetlendi.</strong>
          <span>
            Kaydedilmiş tahminler, dashboard değerleri ve gerçek gözlemler
            yeniden hesaplanarak karşılaştırıldı.
          </span>
        </div>
        <Badge color="teal">SAYISAL DENETİM</Badge>
      </div>
      <div className="metric-explanations">
        <article className="panel">
          <h2>MAE ne demek?</h2>
          <p>
            Tahminin gerçekten gözlenen sıcaklıktan ortalama ne kadar uzak
            olduğunu gösterir. <strong>Daha düşük daha iyi.</strong>
          </p>
        </article>
        <article className="panel">
          <h2>Neye göre daha iyi?</h2>
          <p>
            “Son sıcaklık değişmeden devam eder” diyen persistence modeliyle
            aynı tarihlerde karşılaştırılır.
          </p>
        </article>
        <article className="panel">
          <h2>Aralık ne anlatır?</h2>
          <p>
            Geçmiş hatalardan hesaplanır. %80 kapsama hedefi, her tahmin için
            %80 güven demek değildir.
          </p>
        </article>
      </div>
      {metrics && (
        <section className="panel performance-table">
          <div className="panel-head">
            <div>
              <h2>Önceki sürüm · ayrı test döneminin sonuçları</h2>
              <p>
                {date(snap.evaluation.split.test_start)} —{" "}
                {date(snap.evaluation.split.test_end)} · Gerçek Copernicus
                verisi
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                24, 48 ve 72 saat model değerlendirmesi
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tahmin ufku</th>
                  <th scope="col">MAE (°C)</th>
                  <th scope="col">RMSE (°C)</th>
                  <th scope="col">Persistence MAE</th>
                  <th scope="col">MAE iyileşmesi</th>
                  <th scope="col">%80 aralık kapsaması</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics).map(([h, m]) => (
                  <tr key={h}>
                    <th scope="row">+{Number(h) * 24} saat</th>
                    <td>{temp(m.model.mae_c, 3)}</td>
                    <td>{temp(m.model.rmse_c, 3)}</td>
                    <td>{temp(m.persistence.mae_c, 3)} °C</td>
                    <td>
                      {temp((1 - m.model.mae_c / m.persistence.mae_c) * 100)}%
                    </td>
                    <td>
                      <span
                        className={
                          m.coverage_80 < 0.8 ? "coverage-warning" : ""
                        }
                      >
                        {temp(m.coverage_80 * 100)}%{" "}
                        {m.coverage_80 < 0.8 && <TriangleAlert size={14} />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            +48 ve +72 saatte gerçek aralık kapsaması hedefin altında. Kesinlik
            veya garanti olarak kullanılmamalı.
          </p>
        </section>
      )}
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Sıcak gün uyarısında sınır</h2>
          <p>
            Model ortalama sıcaklık hatasını azaltıyor; ancak P90 sıcak gün
            sınıflamasında persistence’ın F1 skorunu üç ufukta da geçmiyor.
            Sıcaklık doğruluğu ile uyarı başarısı aynı şey değildir.
          </p>
          <div className="f1-comparison">
            {metrics &&
              Object.entries(metrics).map(([h, m]) => (
                <div key={h}>
                  <strong>+{Number(h) * 24} saat</strong>
                  <span>Model F1: {temp(m.warm_day_f1, 3)}</span>
                  <span>
                    Persistence F1:{" "}
                    {temp(audit?.horizons[h]?.persistence_warm_f1, 3)}
                  </span>
                </div>
              ))}
          </div>
          <p>Bu etiket biyolojik zarar veya santral etkisini değerlendirmez.</p>
        </section>
        <section className="panel settings-card">
          <h2>Veri ve sızıntı denetimi</h2>
          <ul className="audit-checks">
            {[
              ["chronological_split", "Kronolojik train / validation / test"],
              ["future_independence", "Özellikler geleceğe erişmiyor"],
              ["frozen_climatology", "Referans yalnız eğitim döneminden"],
              [
                "dashboard_model_match",
                "Dashboard tahminleri modelle eşleşiyor",
              ],
              ["raw_hash", "Ham veri dosyasının hash kontrolü"],
              ["model_preserved", "Eğitilmiş model dosyası korundu"],
            ].map(([key, label]) => (
              <li key={key}>
                <Check size={17} />
                {label}
                <span>
                  {audit?.checks[key] === true ? "Doğrulandı" : "Bekleniyor"}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel settings-card">
          <h2>Veri kalitesi</h2>
          <dl>
            <div>
              <dt>Gerçek tarih aralığı</dt>
              <dd>
                {date(snap?.source.first_observation)} —{" "}
                {date(snap?.source.last_observation)}
              </dd>
            </div>
            <div>
              <dt>Geçerli / eksik gün</dt>
              <dd>
                {snap?.source.valid_days} / {snap?.source.missing_days}
              </dd>
            </div>
            <div>
              <dt>Katalogdaki son gün</dt>
              <dd>
                {date(String(audit?.checks.catalogue_last_observation ?? ""))}
              </dd>
            </div>
            <div>
              <dt>Referansın eğitim sonu</dt>
              <dd>{date(snap?.evaluation.split.train_end)}</dd>
            </div>
          </dl>
          <p>
            Referans, standart 30 yıllık klimatoloji değildir. Test dönemine
            göre güncellenmez.
          </p>
        </section>
      </div>
      {audit && (
        <section className="panel settings-card audit-failures">
          <h2>Model nerede zorlanıyor?</h2>
          <p>
            Test dönemindeki en büyük mutlak hatalar. Ortalama hata bu tekil
            sapmaları gizlememeli.
          </p>
          <div className="worst-grid">
            {Object.entries(audit.horizons).map(([h, m]) => (
              <div key={h}>
                <span>
                  +{Number(h) * 24} saat · {date(m.worst_errors[0].target_date)}
                </span>
                <strong>{temp(m.worst_errors[0].error, 2)} °C</strong>
                <small>En büyük mutlak test hatası</small>
              </div>
            ))}
          </div>
          <ul className="limitations">
            {audit.limitations
              .filter((item) => !item.includes("Rolling-origin"))
              .map((item) => (
                <li key={item}>{item}</li>
              ))}
          </ul>
          <a className="text-link" href="/model-audit.json" download>
            Sayısal denetim raporunu indir
          </a>
        </section>
      )}
      <ReliabilityPerformance />
      <SourceFootnote />
    </>
  );
}
