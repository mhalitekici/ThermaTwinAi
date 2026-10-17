import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, MapPin, Radio } from "lucide-react";
import { date, supabase, integrationError } from "../lib";
import { useApp } from "../context";
import { Badge, PageHead, AuthEmpty } from "../components/common";

type Subscription = {
  user_id: string;
  active: boolean;
  email_enabled: boolean;
  consented_at: string | null;
};
export default function ConnectedSubscriptions() {
  const { session, authReady, notify } = useApp();
  const [record, setRecord] = useState<Subscription | null>(null);
  const [owner, setOwner] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [revision, reload] = useState(0);
  const uid = session?.user.id;
  const current = owner === uid ? record : null;
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setRecord(null);
    setConsent(false);
    setError("");
    setOwner(uid || "");
    if (uid && supabase) {
      void supabase
        .from("subscriptions")
        .select("user_id,active,email_enabled,consented_at")
        .eq("user_id", uid)
        .eq("region_id", "akkuyu")
        .maybeSingle()
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setError("Abonelik yüklenemedi. Yeniden deneyin.");
          else setRecord(data);
          setLoaded(true);
        });
    }
    return () => {
      alive = false;
    };
  }, [uid, revision]);
  async function update(action: string) {
    if (!supabase || !uid || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.rpc("manage_subscription", {
        p_action: action,
        p_consent: consent,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setRecord(row?.user_id ? row : null);
      setOwner(uid);
      setConsent(false);
      notify(
        action === "cancel"
          ? "Abonelik iptal edildi; bildirimler kapatıldı."
          : action === "email_off"
            ? "E-posta bildirimleri durduruldu."
            : "Abonelik tercihiniz kaydedildi.",
      );
    } catch {
      setError(
        "Tercih kaydedilemedi. Oturumunuzu ve bağlantınızı kontrol edin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="KİŞİSEL İZLEME"
        title="Aboneliklerim"
        description="Akkuyu izleme tercihinizi ve bilgi e-postası onayınızı yönetin."
      />
      <div className="notice">
        <div>
          <strong>İzleme ve e-posta izni ayrı yönetilir.</strong>
          <span>
            Açık onay verdikten sonra bildirimler sayfasından kendi adresinize
            bir TEST raporu gönderebilir ve teslim durumunu kontrol
            edebilirsiniz.
          </span>
        </div>
      </div>
      {integrationError && (
        <div className="notice error" role="alert">
          {integrationError}
        </div>
      )}
      {!authReady ? (
        <p role="status">Oturum yükleniyor…</p>
      ) : !session ? (
        <AuthEmpty
          title="İzlemek için giriş yapın"
          description="E-postanıza gelen kodla doğrulayın. Abonelik ve bildirim geçmişi yalnız kendi hesabınıza aittir."
        />
      ) : (
        <section className="panel subscription-card">
          <div className="subscription-visual">
            <MapPin size={34} />
            <span>AKKUYU / 01</span>
          </div>
          <div className="subscription-body">
            <div className="subscription-title">
              <h2>Akkuyu açıkları, Mersin</h2>
              <Badge color={current?.active ? "teal" : "gray"}>
                {current?.active ? "İzleme etkin" : "İzleme kapalı"}
              </Badge>
            </div>
            <p>
              Yalnız gözlemlenmiş sıcaklık anomalileri için bilgi amaçlı e-posta
              izni verebilirsiniz. Acil durum veya ekolojik zarar tespiti
              değildir.
            </p>
            <p className="subscription-email">
              <Mail size={17} />
              {session.user.email}
            </p>
            {current?.active && (
              <p>
                E-posta bildirimleri:{" "}
                <strong>
                  {current.email_enabled ? "Açık onay var" : "Kapalı"}
                </strong>
                {current.consented_at && (
                  <> · Onay: {date(current.consented_at)}</>
                )}
              </p>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
                <button
                  className="text-link"
                  onClick={() => reload((v) => v + 1)}
                >
                  Yeniden yükle
                </button>
              </div>
            )}
            {current?.active && current.email_enabled && (
              <Link className="text-link" to="/alerts">
                <Mail size={16} aria-hidden="true" />
                TEST e-postası ve teslim durumu
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            {!current?.email_enabled && (
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={busy}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Akkuyu’da gözlemlenmiş sıcaklık anomalileri için bilgi
                  e-postası almayı açıkça kabul ediyorum. İstediğim zaman
                  kapatabilirim.
                </span>
              </label>
            )}
            {!loaded ? (
              <p role="status">Abonelik yükleniyor…</p>
            ) : (
              <div className="subscription-actions">
                {!current?.active ? (
                  <button
                    className="btn btn-primary"
                    disabled={busy || !!error}
                    onClick={() => void update("subscribe")}
                  >
                    <Radio size={16} />
                    İzlemeyi etkinleştir
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-primary"
                      disabled={busy || (!current.email_enabled && !consent)}
                      onClick={() =>
                        void update(
                          current.email_enabled ? "email_off" : "email_on",
                        )
                      }
                    >
                      {current.email_enabled
                        ? "Bildirimleri durdur"
                        : "Bildirimleri aç"}
                    </button>
                    <button
                      className="btn btn-white"
                      disabled={busy}
                      onClick={() => void update("cancel")}
                    >
                      Aboneliği iptal et
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
