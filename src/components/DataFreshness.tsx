import { Clock3, Database } from "lucide-react";
import type { Snapshot } from "../lib";
import { date } from "../lib";
import { freshnessState, timestamp } from "../freshness";
import { Badge } from "./common";
import "./freshness.css";

export default function DataFreshness({ snapshot }: { snapshot: Snapshot }) {
  const state = freshnessState(snapshot);
  const fetched = timestamp(snapshot.source.retrieved_at),
    processed = timestamp(snapshot.checked_at);
  const forecastOrigins = [
    ...new Set(snapshot.forecasts.map((f) => f.origin_date)),
  ];
  return (
    <section
      className="panel settings-card data-freshness"
      aria-label="Verinin zaman çizelgesi"
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            <Database size={15} /> VERİNİN ZAMAN ÇİZELGESİ
          </p>
          <h2>Hangi günün denizini görüyoruz?</h2>
        </div>
        <Badge
          color={
            state.status === "current"
              ? "teal"
              : state.status === "historical"
                ? "blue"
                : "amber"
          }
        >
          {state.label}
        </Badge>
      </div>
      <p>
        {state.reason}{" "}
        {state.age !== null && snapshot.mode === "live"
          ? `UTC takvimine göre gözlem yaşı: ${state.age} gün.`
          : ""}
      </p>
      <dl className="freshness-timeline">
        <div>
          <dt>
            <Clock3 size={15} /> Gerçek gözlem günü
          </dt>
          <dd>
            <time dateTime={snapshot.origin_date}>
              {date(snapshot.origin_date, true)}
            </time>
            <small>Günlük analysed_sst; ölçüm saati olarak yorumlanmaz.</small>
          </dd>
        </div>
        <div>
          <dt>Kaynağa erişim</dt>
          <dd>
            {fetched ? (
              <time dateTime={snapshot.source.retrieved_at}>{fetched}</time>
            ) : (
              "Kaynakta zaman bilgisi yok"
            )}
            <small>
              İndirilen arşivin erişim zamanı; yeni gözlem üretildiği anlamına
              gelmez.
            </small>
          </dd>
        </div>
        <div>
          <dt>Analizin işlenmesi</dt>
          <dd>
            {processed ? (
              <time dateTime={snapshot.checked_at}>{processed}</time>
            ) : (
              "İşleme zamanı doğrulanamadı"
            )}
            <small>
              Snapshot'ın hesaplanma/kontrol zamanı; son başarılı monitoring
              turu değildir.
            </small>
          </dd>
        </div>
        <div>
          <dt>Tahmin başlangıcı</dt>
          <dd>
            {forecastOrigins.length
              ? forecastOrigins.map((day) => (
                  <time dateTime={day} key={day}>
                    {date(day)}
                  </time>
                ))
              : "Tahmin kaydı yok"}
            <small>
              Hedef tarihler +24/+48/+72 saattir; yeni gözlem tarihi değildir.
            </small>
          </dd>
        </div>
      </dl>
      <details>
        <summary>Yayın gecikmesi ve monitoring hakkında</summary>
        <p>
          Kaynağın ilk yayın/erişilebilirlik zamanı bu yanıtta yok; gerçek yayın
          gecikmesi hesaplanamaz. Erişim veya işleme zamanı yerine kullanılmaz.
        </p>
        <p>
          Son başarılı monitoring turu:{" "}
          <strong>bu snapshot ile doğrulanamıyor.</strong> Güncel bir gözlem
          görmek, zamanlanmış job'un veya e-posta tesliminin başarılı olduğunu
          kanıtlamaz. Sunucu tur kayıtları ayrı incelenmelidir.
        </p>
        <p>
          Canlı gönderim ayrıca güncel/veri-kalitesi onaylı gözlem, doğrulanmış
          alıcı, açık abonelik onayı ve mevcut gönderim politikası ister. Bu
          kart veya “Veriyi yenile” düğmesi monitoring job'u ya da gönderim
          başlatmaz. Geçmiş TEST yalnız açık kullanıcı eylemidir.
        </p>
      </details>
    </section>
  );
}
