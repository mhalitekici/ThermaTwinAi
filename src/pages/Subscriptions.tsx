import { useState } from "react";
import { Check, Mail, Radio, ShieldCheck } from "lucide-react";
import { useApp } from "../context";
import { integrationsEnabled } from "../lib";
import ConnectedSubscriptions from "../integrations/ConnectedSubscriptions";
import { Badge, PageHead } from "../components/common";
export default function Subscriptions() {
  const { notify } = useApp();
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem("thermatwin-local-watch") === "true";
    } catch {
      return false;
    }
  });
  if (integrationsEnabled) return <ConnectedSubscriptions />;
  function toggle() {
    const next = !saved;
    setSaved(next);
    try {
      localStorage.setItem("thermatwin-local-watch", String(next));
      notify(
        next
          ? "Yerel izleme tercihi kaydedildi. E-posta gönderilmez."
          : "Yerel izleme tercihi kaldırıldı.",
      );
    } catch {
      notify(
        "Yerel kayıt alanı kullanılamıyor; tercih yalnız bu ekran için değişti.",
      );
    }
  }
  return (
    <>
      <PageHead
        eyebrow="KİŞİSEL İZLEME · YEREL PROVA"
        title="Deniz bölgeniz, takibinizde."
        description="Abonelik deneyimini inceleyin. Bu aşamada hesap açılmaz veya e-posta gönderilmez."
      />
      <div className="notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Yerel demo davranışı</strong>
          <span>
            Bu tercih yalnız tarayıcınızda saklanır. Gerçek abonelik veya
            otomatik izleme etkinleşmez.
          </span>
        </div>
        <Badge color="blue">CANLI BAĞLANTI YOK</Badge>
      </div>
      <section className="panel subscription-card">
        <div className="subscription-visual">
          <Radio size={37} />
          <span>AKKUYU</span>
          <small>Doğu Akdeniz</small>
        </div>
        <div className="subscription-body">
          <div className="subscription-title">
            <div>
              <h2>Akkuyu açıkları, Mersin</h2>
              <p>Günlük deniz yüzeyi sıcaklığı</p>
            </div>
            <Badge color={saved ? "blue" : "gray"}>
              {saved ? "Yerel tercih kaydedildi" : "Yerel tercih yok"}
            </Badge>
          </div>
          <p>
            Bölgenin gözlem, tahmin ve anomali raporlarını takip etmek için
            tasarlanan abonelik akışı. Gerçek bildirimler sonraki entegrasyon
            aşamasında açılacak.
          </p>
          <ul className="feature-list">
            <li>
              <Check size={17} />
              Günlük SST ve üç günlük tahmin
            </li>
            <li>
              <Check size={17} />
              Gözlem ve tahmin için ayrı raporlar
            </li>
            <li>
              <Mail size={17} />
              E-posta bildirimleri henüz kapalı
            </li>
          </ul>
          <button
            className={`btn ${saved ? "btn-white" : "btn-primary"}`}
            onClick={toggle}
          >
            <Radio size={16} />
            {saved
              ? "Yerel izleme tercihini kaldır"
              : "Yerel izleme tercihini kaydet"}
          </button>
          <p className="fine-print">Gerçek bir abonelik oluşturmaz.</p>
        </div>
      </section>
    </>
  );
}
