import { AppLink as Link } from "../components/common";

import { ArrowRight, Info } from "lucide-react";
import { useApp } from "../context";
import { date } from "../lib";
import {
  DashboardSkeleton,
  ModeNotice,
  PageHead,
  SourceFootnote,
} from "../components/common";
import ForecastSummary from "../components/ForecastSummary";
import TemperatureChart from "../components/TemperatureChart";
import RiskInsight from "../components/RiskInsight";
import EarlyWarningPanel from "../components/EarlyWarningPanel";
export default function Forecasts() {
  const { snap, loading } = useApp();
  return (
    <>
      <PageHead
        eyebrow="AI TAHMİNLERİ"
        title="Denizin önümüzdeki üç günü."
        description="Son gözlemden başlayan model tahminlerini, aralıkları ve olası eşik aşımlarını inceleyin."
      >
        <Link className="btn btn-white" to="/performance">
          Model performansı <ArrowRight size={16} />
        </Link>
      </PageHead>
      <ModeNotice />
      {loading ? (
        <DashboardSkeleton />
      ) : (
        snap && (
          <>
            <ForecastSummary snapshot={snap} />
            <EarlyWarningPanel snapshot={snap} />
            <div className="forecast-explainer">
              <Info size={19} />
              <p>
                Bu tahminler <strong>{date(snap.origin_date, true)}</strong>{" "}
                tarihindeki günlük gözlemden başlar. Aralıklar geçmiş model
                hatalarını özetler; anlık sensör ölçümü veya garanti değildir.
              </p>
            </div>
            <TemperatureChart snapshot={snap} initialDays={14} />
            <div className="forecast-risk-grid">
              {snap.forecasts.map((f) => (
                <RiskInsight
                  key={f.horizon_days}
                  kind="predicted"
                  value={f}
                  eventDate={f.target_date}
                />
              ))}
            </div>
            <SourceFootnote />
          </>
        )
      )}
    </>
  );
}
