import { CheckCircle2, TriangleAlert, TrendingUp, Eye } from "lucide-react";
import type { Risk, WarningSignal } from "../lib";
import { date, temp } from "../lib";
import { riskDetail } from "../science";
import { RiskBadge } from "./common";
export default function RiskInsight({
  kind,
  value,
  eventDate,
}: {
  kind: "observed" | "predicted";
  value: {
    sst_c: number;
    reference_c: number;
    p90_c: number;
    risk: Risk;
    warning?: WarningSignal;
  };
  eventDate: string;
}) {
  const detail = riskDetail(value),
    Icon = value.risk === "normal" ? CheckCircle2 : TriangleAlert;
  return (
    <article className={`panel risk-insight ${value.risk}`}>
      <div className="insight-top">
        <span className="insight-kind">
          {kind === "observed" ? <Eye size={16} /> : <TrendingUp size={16} />}{" "}
          {kind === "observed" ? "Gözlenen durum" : "Tahmin edilen durum"}
        </span>
        <RiskBadge risk={value.risk} />
      </div>
      <h3>
        <Icon size={19} />
        {kind === "predicted" && value.warning
          ? value.warning.triggered
            ? "Öngörülen anomali riski için uyarı sinyali."
            : "Seçilen erken uyarı kuralı tetiklenmiyor."
          : detail.meaning}
      </h3>
      <p>
        <strong>{date(eventDate, true)}</strong> ·{" "}
        {kind === "observed" ? "Gözlem" : "Tahmin"} {temp(value.sst_c)} °C.
        Mevsimsel normalden{" "}
        <strong>
          {temp(Math.abs(detail.difference))} °C{" "}
          {detail.difference >= 0 ? "yüksek" : "düşük"}
        </strong>
        ; {temp(value.p90_c)} °C eşiğinin {temp(Math.abs(detail.exceed))} °C{" "}
        {detail.exceed > 0 ? "üzerinde" : "altında"}.
      </p>
      <p className="insight-action">
        {kind === "predicted" && value.warning
          ? "Rozet nokta tahmininin P90 sınıfıdır. Erken uyarı, ayrıca doğrulama döneminde seçilen kurala göre hesaplanır."
          : detail.action}
      </p>
      {kind === "predicted" && value.warning && (
        <p className="insight-action">
          <strong>Uyarı kuralı: </strong>
          {value.warning.reason}
        </p>
      )}
    </article>
  );
}
