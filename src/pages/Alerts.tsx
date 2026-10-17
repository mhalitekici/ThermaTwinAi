import { AppLink as Link } from "../components/common";
import { useState } from "react";

import { ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import { useApp } from "../context";
import { integrationsEnabled } from "../lib";
import type { Report } from "../lib";
import ConnectedAlerts from "../integrations/ConnectedAlerts";
import {
  ModeNotice,
  PageHead,
  ReportModal,
  ReportRow,
  SourceFootnote,
} from "../components/common";
import RiskInsight from "../components/RiskInsight";
import EarlyWarningPanel from "../components/EarlyWarningPanel";
import { isStale } from "../science";
export default function Alerts() {
  const { snap, mode } = useApp(),
    [filter, setFilter] = useState("all"),
    [report, setReport] = useState<Report | null>(null);
  const reports =
    (snap && !isStale(snap)
      ? snap.reports.filter((r) => filter === "all" || r.facts.kind === filter)
      : []) ?? [];
  const prediction =
    snap?.forecasts.find((f) => f.risk !== "normal") ?? snap?.forecasts[2];
  return (
    <>
      <PageHead
        eyebrow="ANOMALİ UYARILARI"
        title="Değişimi, nedeni ile birlikte görün."
        description="Gözlenmiş eşik aşımları ile modelin öngördüğü durumlar burada ayrı gösterilir."
      >
        <Link to="/history" className="btn btn-white">
          <FlaskConical size={17} />
          Geçmiş olayları incele
        </Link>
      </PageHead>
      <ModeNotice />
      {snap && <EarlyWarningPanel snapshot={snap} />}
      {snap && (
        <div className="insight-grid">
          <RiskInsight
            kind="observed"
            value={snap.observation}
            eventDate={snap.origin_date}
          />
          {prediction && (
            <RiskInsight
              kind="predicted"
              value={prediction}
              eventDate={prediction.target_date}
            />
          )}
        </div>
      )}
      <section className="panel alerts-panel">
        <div className="panel-head">
          <div>
            <h2>
              {mode === "replay"
                ? "Geçmiş olay raporları"
                : "Son gözlemin raporları"}
            </h2>
            <p>Bu görünümde {reports.length} rapor</p>
          </div>
          <div className="segmented" aria-label="Rapor türü">
            {[
              ["all", "Tümü"],
              ["observed", "Gözlemlenen"],
              ["predicted", "Tahmin edilen"],
            ].map(([value, label]) => (
              <button
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {reports.length ? (
          reports.map((r, i) => (
            <ReportRow key={i} report={r} onClick={() => setReport(r)} />
          ))
        ) : (
          <div className="calm-empty">
            <CheckCircle2 size={32} />
            <h3>Bu görünümde eşik aşımı raporu yok.</h3>
            <p>
              Uyarı olmaması, yalnız bu gözlem ve modelin hesapladığı eşikler
              için geçerlidir.
            </p>
          </div>
        )}
      </section>
      {integrationsEnabled ? (
        <ConnectedAlerts />
      ) : (
        <div className="integration-note">
          <strong>Demo görünümünde gerçek e-posta bağlantısı kapalı.</strong>
          <p>
            Burada gerçek analiz raporları gösterilir. Bildirim gönderilmez ve
            gerçek abonelik açılmaz.
          </p>
          <Link to="/subscriptions" className="text-link">
            Abonelik provasını incele <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <SourceFootnote />
      {report && <ReportModal report={report} close={() => setReport(null)} />}
    </>
  );
}
