import { AppLink as Link } from "../components/common";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  FlaskConical,
} from "lucide-react";
import { useApp } from "../context";
import type { Snapshot } from "../lib";
import { date, readReplayEvents, temp } from "../lib";
import {
  Badge,
  DashboardSkeleton,
  EmptyState,
  ModeNotice,
  PageHead,
  ReportModal,
  RiskBadge,
  SourceFootnote,
} from "../components/common";
import TemperatureChart from "../components/TemperatureChart";
import RiskInsight from "../components/RiskInsight";
import EarlyWarningPanel from "../components/EarlyWarningPanel";
export default function HistoryPage() {
  const { mode, snap, loading, selectReplay } = useApp();
  const [events, setEvents] = useState<Snapshot[]>([]),
    [error, setError] = useState(""),
    [reportOpen, setReportOpen] = useState(false),
    [params] = useSearchParams();
  useEffect(() => {
    let alive = true;
    readReplayEvents()
      .then((data) => {
        if (alive) setEvents(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const selected =
    events.find(
      (e) => e.origin_date === (params.get("event") || snap?.origin_date),
    ) ??
    events.find((e) => e.origin_date === "2024-06-07") ??
    events[0];
  const active =
    mode === "replay" &&
    selected?.origin_date === snap?.origin_date &&
    selected?.source.dataset_id === snap?.source.dataset_id;
  const comparison = active ? selected?.comparison : null;
  const report =
    snap?.reports.find((r) => r.facts.kind === "observed") ?? snap?.reports[0];
  return (
    <>
      <PageHead
        eyebrow="HISTORICAL REPLAY · GERÇEK VERİ"
        title="Bir sıcak olayın hikâyesi."
        description="Geçmiş bir olayı seçin. Veriyi, referansı ve sistemin neden uyarı verdiğini birlikte inceleyin."
      />
      <div className="replay-intro">
        <FlaskConical size={23} />
        <div>
          <strong>
            Jüri demosu için hazır. Bilimsel sınırlarıyla birlikte.
          </strong>
          <p>
            Bu bölüm geçmişte gözlenmiş olayları tekrarlar. Güncel izleme veya
            e-posta gönderimi başlatmaz.
          </p>
        </div>
        <Badge color="amber">GEÇMİŞ ANALİZ</Badge>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <section
        className="event-picker panel"
        aria-labelledby="event-picker-title"
      >
        <div className="panel-head">
          <div>
            <h2 id="event-picker-title">İncelemek istediğiniz olayı seçin</h2>
            <p>
              Akkuyu açıkları · Copernicus · Ayrı test döneminden gerçek olaylar
            </p>
          </div>
        </div>
        <div className="event-options">
          {events.map((event) => (
            <button
              key={event.origin_date}
              className={
                active && event.origin_date === selected?.origin_date
                  ? "selected"
                  : ""
              }
              aria-pressed={
                active && event.origin_date === selected?.origin_date
              }
              onClick={() => selectReplay(event.origin_date)}
            >
              {event.replay_label && <span>{event.replay_label}</span>}
              <span>
                <CalendarDays size={17} />
                {date(event.origin_date, true)}
              </span>
              <strong>
                {temp(event.observation.sst_c)}
                <small> °C</small>
              </strong>
              <span>
                Normalden {event.observation.anomaly_c >= 0 ? "+" : ""}
                {temp(event.observation.anomaly_c)} °C
              </span>
              <span className="event-action">
                {active && event.origin_date === selected?.origin_date ? (
                  <>
                    <Check size={15} />
                    İnceleniyor
                  </>
                ) : (
                  <>
                    Olayı incele <ArrowRight size={15} />
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      </section>
      {mode === "replay" && <ModeNotice />}
      {loading && mode === "replay" ? (
        <DashboardSkeleton />
      ) : active ? (
        <>
          {loading ? (
            <DashboardSkeleton />
          ) : (
            snap && (
              <>
                <div className="story-steps">
                  <span>
                    <b>01</b> Gerçek gözlem
                  </span>
                  <i />
                  <span>
                    <b>02</b> Normalle karşılaştır
                  </span>
                  <i />
                  <span>
                    <b>03</b> Sinyali açıkla
                  </span>
                </div>
                <div className="comparison-grid">
                  <section className="panel comparison-card">
                    <span className="eyebrow">GÖZLENMİŞ NORMAL GÜN</span>
                    <h2>{date(comparison?.date, true)}</h2>
                    <div className="comparison-temperature">
                      {temp(comparison?.sst_c)} <small>°C</small>
                    </div>
                    <RiskBadge risk="normal" />
                    <p>
                      Aynı takvim ayından, olaydan önceki gerçek bir gözlem.
                      Mevsimsel normalden fark: {temp(comparison?.anomaly_c, 2)}{" "}
                      °C.
                    </p>
                  </section>
                  <section className="panel comparison-card event">
                    <span className="eyebrow">
                      {snap.observation.duration_days
                        ? "SEÇİLEN SICAK OLAY"
                        : "SEÇİLEN GEÇMİŞ GÜN"}
                    </span>
                    <h2>{date(snap.origin_date, true)}</h2>
                    <div className="comparison-temperature">
                      {temp(snap.observation.sst_c)} <small>°C</small>
                    </div>
                    <RiskBadge risk={snap.observation.risk} />
                    <p>
                      {snap.observation.duration_days} ardışık gözlem sıcak gün
                      eşiğinin üzerinde. Mevsimsel normalden fark:{" "}
                      {snap.observation.anomaly_c >= 0 ? "+" : ""}
                      {temp(snap.observation.anomaly_c)} °C.
                    </p>
                  </section>
                  <section className="panel story-explanation">
                    <Badge color="blue">NEDEN ANOMALİ?</Badge>
                    <h2>
                      {snap.observation.duration_days
                        ? "Sadece “sıcak” olduğu için değil."
                        : "Gözlem ile gelecek riski ayrıdır."}
                    </h2>
                    <p>
                      Gözlem, o takvim gününe ait{" "}
                      <strong>{temp(snap.observation.p90_c)} °C</strong> sıcak
                      gün eşiğinin{" "}
                      {snap.observation.duration_days
                        ? "üzerinde"
                        : "altında veya eşit"}
                      . Referans yalnız eğitim döneminden hesaplandı.
                    </p>
                    <p>
                      {snap.observation.mhw
                        ? "En az beş ardışık gözlem eşik üzerinde; uygulamanın MHW süre koşulu sağlanıyor."
                        : "Süre koşulu henüz tamamlanmadı; doğrulanmış MHW olarak sunulmaz."}
                    </p>
                    {report && (
                      <button
                        className="btn btn-white"
                        onClick={() => setReportOpen(true)}
                      >
                        <FileText size={17} />
                        Olay raporunu aç
                      </button>
                    )}
                  </section>
                </div>
                <p className="comparison-note">
                  {comparison?.note} Dönemler arasındaki fark, tesis etkisi
                  olarak yorumlanmaz.
                </p>
                <TemperatureChart snapshot={snap} initialDays={30} />
                <EarlyWarningPanel snapshot={snap} />
                {snap.replay_assessment && (
                  <section className="panel settings-card">
                    <h2>Geçmiş uyarının gerçek sonucu</h2>
                    <p>{snap.replay_assessment}</p>
                    <p>
                      Bu örnekler genel başarı ölçümü için seçilmedi. Tüm dönem
                      sonuçları Model performansı sayfasındadır.
                    </p>
                  </section>
                )}
                <RiskInsight
                  kind="observed"
                  value={snap.observation}
                  eventDate={snap.origin_date}
                />
                <div className="replay-end">
                  <SourceFootnote />
                  <Link
                    className="btn btn-white"
                    to={"/forecasts" + params.toString().replace(/^/, "?")}
                  >
                    Olay tarihindeki model tahminleri <ArrowRight size={16} />
                  </Link>
                </div>
              </>
            )
          )}
          {reportOpen && report && (
            <ReportModal report={report} close={() => setReportOpen(false)} />
          )}
        </>
      ) : (
        <section className="panel">
          <EmptyState
            title="Geçmiş olayı başlatmaya hazırsınız."
            description="Yukarıdan bir tarih seçin. Normal bir günle karşılaştırmayı, sıcaklık grafiğini ve açıklamalı raporu birlikte göreceksiniz."
          />
        </section>
      )}
    </>
  );
}
