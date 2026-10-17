import { ArrowDownRight, ArrowUpRight, ArrowRight, Clock3 } from "lucide-react";
import { AppLink as Link } from "./common";
import type { Snapshot } from "../lib";
import { date, temp } from "../lib";
import { HelpTip, RiskBadge } from "./common";
export default function ForecastSummary({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="panel forecast-summary">
      <div className="panel-head">
        <div>
          <h2>Önümüzdeki 3 gün</h2>
          <p>{date(snapshot.origin_date)} gözleminden başlayan tahminler</p>
        </div>
        <Link to="/forecasts" className="text-link">
          İncele <ArrowRight size={15} />
        </Link>
      </div>
      <div className="forecast-cards">
        {snapshot.forecasts.map((f) => {
          const up = f.sst_c >= snapshot.observation.sst_c;
          return (
            <article key={f.horizon_days}>
              <div className="forecast-horizon">
                <Clock3 size={14} />
                <strong>+{f.horizon_days * 24} saat</strong>
              </div>
              <span className="forecast-date">{date(f.target_date)}</span>
              <div className="forecast-value">
                {temp(f.sst_c)}
                <small>°C</small>
              </div>
              <div className="forecast-change">
                {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                Son gözleme göre {up ? "+" : ""}
                {temp(f.sst_c - snapshot.observation.sst_c)} °C
              </div>
              <RiskBadge risk={f.risk} />
              {f.warning?.triggered && (
                <small>Erken uyarı sinyali · gerçekleşme garantisi değil</small>
              )}
              <p className="forecast-range">
                {temp(f.lower_c)}–{temp(f.upper_c)} °C{" "}
                <HelpTip
                  label={`+${f.horizon_days * 24} saat tahmin aralığı açıklaması`}
                  text={
                    f.interval
                      ? `Ayrı kalibrasyon hatalarından hesaplanan mevsimsel aralık. Hedef %80; ayrı testte bu ufukta ölçülen kapsama %${temp(f.interval.test_coverage * 100)}. Kalibrasyon sonu ${date(f.interval.calibration_end)}. Her tarihte garanti veya kişisel güven yüzdesi değildir.`
                      : "Geçmiş doğrulama hatalarından hesaplanan ampirik aralık. %80 kapsama hedeflenir; her tarihte gerçekleşme garantisi veya kişisel güven yüzdesi değildir."
                  }
                />
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
