import type { Snapshot } from "../lib";
import { date, integrationsEnabled } from "../lib";
import { isStale } from "../science";
import { Badge } from "./common";

export default function EarlyWarningPanel({
  snapshot,
}: {
  snapshot: Snapshot;
}) {
  const warning = snapshot.early_warning;
  const stale = isStale(snapshot);
  const state = stale ? "insufficient_data" : warning?.state;
  const label = {
    normal: "Normal koşullar",
    observed_anomaly: "Gözlemlenmiş sıcaklık anomalisi",
    forecast_risk: "Geleceğe yönelik sıcaklık anomalisi riski",
    insufficient_data: "Yetersiz veya güncel olmayan veri",
  };
  return (
    <section
      className="panel settings-card early-warning"
      aria-label="Erken uyarı değerlendirmesi"
    >
      <div className="panel-head">
        <div>
          <h2>{state ? label[state] : "Uyarı değerlendirmesi bulunmuyor"}</h2>
          <p>
            Veri tarihi: {date(snapshot.origin_date, true)} ·{" "}
            {snapshot.mode === "replay"
              ? "Geçmiş olay değerlendirmesi"
              : "Son gözlem değerlendirmesi"}
          </p>
        </div>
        <Badge color={state === "normal" ? "teal" : "amber"}>
          ERKEN UYARI PROTOTİPİ
        </Badge>
      </div>
      <p>
        {stale
          ? "Veri üç günden eski. Yeni uyarı üretilmez; aşağıdaki değerler son gözlem tarihine aittir."
          : (warning?.reason ??
            "Bu veri için doğrulanmış bir uyarı politikası yüklenmedi.")}
      </p>
      {!stale && warning && (
        <p>
          {warning.horizon_hours !== null && (
            <>Ufuk: {warning.horizon_hours} saat. </>
          )}
          {warning.suppression_reason ||
            (warning.notify
              ? "Olay başlangıcı veya gözlemsel teyit kaydı."
              : "Yeni bildirim kaydı yok.")}{" "}
          {warning.rule}
        </p>
      )}
      <p className="table-note">
        Tahmin aralığı sıcaklık belirsizliğini gösterir; olayın gerçekleşme
        olasılığı değildir.{" "}
        {integrationsEnabled
          ? "E-posta izni ve sunucu gönderim modu ayrıca kontrol edilir."
          : "E-posta gönderimi kapalıdır."}
      </p>
    </section>
  );
}
