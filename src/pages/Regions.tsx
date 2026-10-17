import { AppLink as Link } from "../components/common";

import { MapPin, Radio } from "lucide-react";
import { useApp } from "../context";
import { Badge, MapPanel, ModeNotice, PageHead } from "../components/common";

export default function Regions() {
  const { snap } = useApp();
  return (
    <>
      <PageHead
        eyebrow="COĞRAFİ ÇALIŞMA ALANI"
        title="Deniz bölgeleri"
        description="İzlemek istediğiniz deniz bölgesini haritada inceleyin."
      />
      <ModeNotice />
      <div className="region-grid">
        <section className="panel">
          <MapPanel large />
        </section>
        <section className="panel region-detail">
          <Badge>İzleme alanı</Badge>
          <h2>Akkuyu açıkları</h2>
          <p className="muted">Mersin · Doğu Akdeniz</p>
          <div className="region-coordinate">
            <MapPin size={19} />
            36.05° N / 33.55° E
          </div>
          <p>
            Kesikli çerçeve, günlük SST için tanımlanan izleme alanıdır. Veri ve
            tahmin altyapısı şu anda yalnızca bu bölgeyi destekler.
          </p>
          <dl>
            <div>
              <dt>Güney / Kuzey</dt>
              <dd>35.95° / 36.15°</dd>
            </div>
            <div>
              <dt>Batı / Doğu</dt>
              <dd>33.40° / 33.70°</dd>
            </div>
            <div>
              <dt>Veri çözünürlüğü</dt>
              <dd>{snap?.source.resolution || "Copernicus: 0,01°"}</dd>
            </div>
          </dl>
          {snap?.source.limitation && (
            <div className="small-notice">{snap.source.limitation}</div>
          )}
          <Link to="/subscriptions" className="btn btn-primary full">
            <Radio size={17} /> Bölgeyi izlemeye al
          </Link>
          <p className="fine-print">
            Kıyı veya deşarjın ayrıntılı termal yayılım haritası değildir.
          </p>
        </section>
      </div>
    </>
  );
}
