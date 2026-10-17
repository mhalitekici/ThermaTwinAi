import { AppLink as Link } from "../components/common";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  FlaskConical,
  MapPin,
  RefreshCw,
  Thermometer,
  Waves,
} from "lucide-react";
import { useApp } from "../context";
import { date, temp } from "../lib";
import {
  DashboardSkeleton,
  EmptyState,
  HelpTip,
  MapPanel,
  ModeNotice,
  PageHead,
  RiskBadge,
  SourceFootnote,
} from "../components/common";
import TemperatureChart from "../components/TemperatureChart";
import ForecastSummary from "../components/ForecastSummary";
import RiskInsight from "../components/RiskInsight";
import EarlyWarningPanel from "../components/EarlyWarningPanel";
import DataFreshness from "../components/DataFreshness";
export default function Dashboard() {
  const { snap, loading, refresh, mode } = useApp(),
    navigate = useNavigate();
  const location = useLocation();
  const future =
    snap?.forecasts.find((f) => f.risk === "high") ??
    snap?.forecasts.find((f) => f.risk === "watch") ??
    snap?.forecasts[2];
  return (
    <>
      <PageHead
        eyebrow="AKDENİZ GÖZLEM PLATFORMU"
        title="Denize daha yakından bakın."
        description="Günlük sıcaklık, beklenen değişim ve inceleme gerektiren durumlar."
      >
        <Link className="btn btn-white" to="/history">
          <FlaskConical size={17} />
          Geçmiş bir olayı keşfet
        </Link>
        <button className="btn btn-primary" onClick={refresh}>
          <RefreshCw size={16} />
          Veriyi yenile
        </button>
      </PageHead>
      <ModeNotice />
      {loading ? (
        <DashboardSkeleton />
      ) : snap ? (
        <>
          <div className="region-bar">
            <button
              className="region-selector"
              onClick={() => navigate("/regions" + location.search)}
            >
              <span className="region-icon">
                <Waves size={20} />
              </span>
              <span>
                <strong>Akkuyu açıkları</strong>
                <small>Mersin, Türkiye · Doğu Akdeniz</small>
              </span>
              <ChevronDown size={17} />
            </button>
            <span className="observation-date">
              <Clock3 size={15} />
              Son gözlem <strong>{date(snap.origin_date, true)}</strong>
            </span>
          </div>
          <div className="summary-grid">
            <section className="panel current-temperature">
              <div className="current-label">
                <span>
                  <Thermometer size={17} />
                  Deniz yüzeyi sıcaklığı
                </span>
                <HelpTip
                  text="Günlük uydu verisinden deniz hücrelerinin bölgesel ortalaması. Anlık veya kıyıda tek noktadan alınmış bir sensör ölçümü değildir."
                  label="Deniz yüzeyi sıcaklığı nedir?"
                />
              </div>
              <div className="temperature-value">
                {temp(snap.observation.sst_c)}
                <span>°C</span>
              </div>
              <RiskBadge risk={snap.observation.risk} />
              <div className="normal-comparison">
                <span>
                  Mevsimsel normal{" "}
                  <strong>{temp(snap.observation.reference_c)} °C</strong>
                </span>
                <span>
                  Normalden fark{" "}
                  <strong className="neutral-anomaly">
                    {snap.observation.anomaly_c >= 0 ? "+" : ""}
                    {temp(snap.observation.anomaly_c)} °C
                  </strong>
                </span>
              </div>
            </section>
            <ForecastSummary snapshot={snap} />
          </div>
          <DataFreshness snapshot={snap} />
          <div className="insight-grid">
            <RiskInsight
              kind="observed"
              value={snap.observation}
              eventDate={snap.origin_date}
            />
            {future && (
              <RiskInsight
                kind="predicted"
                value={future}
                eventDate={future.target_date}
              />
            )}
          </div>
          <EarlyWarningPanel snapshot={snap} />
          <div className="overview-grid">
            <TemperatureChart snapshot={snap} />
            <section className="panel overview-map">
              <div className="panel-head">
                <div>
                  <h2>İzleme bölgesi</h2>
                  <p>
                    <MapPin size={13} />
                    Akkuyu açıkları · ~1 km SST
                  </p>
                </div>
                <Link
                  to="/regions"
                  className="icon-button"
                  aria-label="Deniz izleme haritasını aç"
                >
                  <ArrowRight size={18} />
                </Link>
              </div>
              <MapPanel />
              <div className="map-summary">
                <strong>Tek bölge. Açık veri. İzlenebilir sonuç.</strong>
                <p>
                  Kesikli alan analiz bölgesini gösterir. Veri ve model kapsamı
                  yalnız Akkuyu açıklarıdır.
                </p>
                <Link className="text-link" to="/regions">
                  Bölge ayrıntıları <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          </div>
          <div className="overview-bottom">
            <SourceFootnote />
            <Link className="text-link" to="/performance">
              Model ne kadar doğru? <ArrowRight size={15} />
            </Link>
          </div>
          {mode === "replay" && (
            <Link className="replay-next text-link" to="/history?mode=replay">
              Bu geçmiş olayı adım adım incele <ArrowRight size={15} />
            </Link>
          )}
        </>
      ) : (
        !loading && (
          <section className="panel">
            <EmptyState
              title="Henüz doğrulanmış gözlem yok"
              description="Veri dosyasını yenileyebilir veya gerçek geçmiş olayları inceleyebilirsiniz."
            >
              <Link to="/history" className="btn btn-primary">
                Geçmiş analiz
              </Link>
            </EmptyState>
          </section>
        )
      )}
    </>
  );
}
