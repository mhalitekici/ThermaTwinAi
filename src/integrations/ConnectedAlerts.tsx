import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleCheck,
  LoaderCircle,
  Mail,
  RefreshCw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { api, date, supabase } from "../lib";
import type { Report } from "../lib";
import { useApp } from "../context";
import { Badge, ReportModal } from "../components/common";

type Delivery = {
  id: string;
  status: string;
  dispatch_mode: string;
  created_at: string;
  alerts: { report: Report; mode: string } | null;
};
type Capabilities = {
  mode: string;
  automatic_enabled: boolean;
  test_enabled: boolean;
  test_configured?: boolean;
  forecast_enabled: boolean;
};
const deliveryLabels: Record<string, string> = {
  sent: "Resend kabul etti",
  shadow: "Gönderilmedi · prova",
  skipped: "Koşul nedeniyle durduruldu",
  failed: "Gönderim hatası",
  pending: "Bekliyor",
  sending: "İşleniyor",
  uncertain: "Manuel kontrol gerekli",
};
const providerLabels: Record<string, string> = {
  delivered:
    "Alıcının posta sunucusuna teslim edildi. Gelen kutusu, spam ve diğer klasörlerde ThermaTwin veya TEST başlığını arayın.",
  opened:
    "Sağlayıcı açılma sinyali bildirdi. Otomatik posta tarayıcıları da bu sinyali oluşturabilir.",
  clicked:
    "Sağlayıcı bağlantı tıklama sinyali bildirdi. Gelen kutusu yerleşimi ayrıca doğrulanmalıdır.",
  delivery_delayed:
    "Alıcının posta sunucusuna teslim gecikti. Daha sonra tekrar kontrol edin.",
  bounced:
    "Alıcının posta sunucusu e-postayı reddetti. Hesabınızdaki adresi kontrol edin.",
  complained:
    "Bu mesaj için spam şikâyeti bildirildi. Bildirim tercihlerinizi kontrol edin.",
  failed: "Sağlayıcı gönderimi tamamlayamadı. Gönderim kaydını kontrol edin.",
  suppressed:
    "Sağlayıcı bu adrese gönderimi durdurdu. Resend panelindeki alıcı durumunu kontrol edin.",
  sent: "Gönderim kabul edildi; teslim henüz doğrulanmadı. Biraz sonra tekrar kontrol edin.",
  queued: "E-posta sağlayıcının kuyruğunda; henüz teslim edilmedi.",
  scheduled: "E-posta sağlayıcıda zamanlandı; henüz teslim edilmedi.",
};
function DeliveryStatus({ id, token }: { id: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function check() {
    if (busy) return;
    controller.current = new AbortController();
    setBusy(true);
    try {
      const response = await fetch(`${api}/deliveries/${id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(25000),
        ]),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Teslim durumu okunamadı.",
        );
      setMessage(
        providerLabels[result.provider_status] ||
          "Sağlayıcıda doğrulanmış teslim bilgisi yok. Daha sonra yeniden kontrol edin.",
      );
    } catch (error) {
      if (controller.current?.signal.aborted) return;
      setMessage(
        error instanceof TypeError
          ? "Bildirim servisine erişilemiyor. Bağlantıyı kontrol edip yeniden deneyin."
          : error instanceof Error && error.name === "TimeoutError"
            ? "Kontrol zaman aşımına uğradı. Yeniden deneyin."
            : (error as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="delivery-status">
      <button
        className="text-link"
        disabled={busy}
        onClick={() => void check()}
        aria-busy={busy}
      >
        <RefreshCw size={15} aria-hidden="true" />
        {busy ? "Teslim kontrol ediliyor…" : "Teslim durumunu kontrol et"}
      </button>
      {message && <p aria-live="polite">{message}</p>}
    </div>
  );
}
export default function ConnectedAlerts() {
  const { snap, mode, session, notify, authReady } = useApp();
  const uid = session?.user.id;
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [revision, reload] = useState(0);
  const [selected, select] = useState<Report | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [serviceRevision, retryService] = useState(0);
  const [feedback, setFeedback] = useState<{
    owner: string;
    text: string;
    failed: boolean;
  } | null>(null);
  const account = useRef(uid);
  useEffect(() => {
    account.current = uid;
  }, [uid]);
  useEffect(() => {
    const controller = new AbortController();
    setCaps(null);
    setServiceError("");
    fetch(api + "/health", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!data.notifications) throw new Error();
        if (!controller.signal.aborted) setCaps(data.notifications);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setServiceError(
            "E-posta servisine bağlanılamadı. Bağlantıyı kontrol edip yeniden deneyin.",
          );
      });
    return () => controller.abort();
  }, [serviceRevision]);
  useEffect(() => {
    let alive = true;
    setDeliveries([]);
    setOwner(uid || "");
    setError("");
    select(null);
    if (uid && supabase)
      void supabase
        .from("deliveries")
        .select("id,status,dispatch_mode,created_at,alerts(report,mode)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) setError("Bildirim geçmişi yüklenemedi.");
          else setDeliveries((data || []) as unknown as Delivery[]);
        });
    return () => {
      alive = false;
    };
  }, [uid, revision]);
  const testDate = mode === "replay" && snap ? snap.origin_date : "2024-06-07";
  async function sendTest() {
    if (!session || sending) return;
    const sender = session.user.id;
    setSending(true);
    setFeedback(null);
    let message: string;
    let failed: boolean;
    try {
      const r = await fetch(api + "/replay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ send_email: true, origin_date: testDate }),
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "TEST isteği tamamlanamadı. Bildirim geçmişini kontrol edin.",
        );
      const sent = result.delivery.reduce(
        (n: number, d: { sent: number }) => n + d.sent,
        0,
      );
      failed = result.delivery.some((d: { failed: number }) => d.failed > 0);
      message = sent
        ? "TEST e-postası Resend tarafından kabul edildi. Aşağıdaki kayıttan teslim durumunu kontrol edebilirsiniz."
        : failed
          ? "Gönderim başarısız; durum kaydı oluşturuldu. Bildirim geçmişini kontrol edin."
          : "Yeni gönderim yapılmadı. Aynı olay yeniden gönderilmez; önceki kaydın teslim durumunu kontrol edin. Alıcı ve veri koşulları da gönderimi engelleyebilir.";
    } catch (e) {
      failed = true;
      message =
        e instanceof TypeError
          ? "E-posta servisine erişilemiyor. Bağlantıyı kontrol edip yeniden deneyin."
          : e instanceof Error && e.name === "TimeoutError"
            ? "Gönderim yanıtı gecikti. Tekrar denemeden önce aşağıdaki bildirim geçmişini yenileyin."
            : e instanceof SyntaxError
              ? "E-posta servisinden geçerli yanıt alınamadı. Bildirim geçmişini kontrol edin."
              : (e as Error).message;
    } finally {
      setSending(false);
    }
    if (account.current !== sender) return;
    setFeedback({ owner: sender, text: message, failed });
    notify(message);
    reload((v) => v + 1);
  }
  const history = owner === uid ? deliveries : [];
  const disabledReason = !authReady
    ? "Oturum kontrol ediliyor…"
    : !session
      ? "TEST göndermek için giriş yapın."
      : serviceError
        ? "E-posta servisi çevrimdışı. Önce bağlantıyı yeniden deneyin."
        : !caps
          ? "E-posta servisi kontrol ediliyor…"
          : !caps.test_enabled
            ? "Manuel TEST gönderimi sunucuda kapalı."
            : caps.test_configured === false
              ? "E-posta servisi yapılandırması eksik. Sunucu ayarlarını kontrol edin."
              : "";
  return (
    <>
      <section
        className="panel notification-card"
        aria-labelledby="notification-title"
      >
        <div className="notification-heading">
          <div className="notification-icon">
            <Mail size={23} aria-hidden="true" />
          </div>
          <div>
            <h2 id="notification-title">E-posta bildirimleri</h2>
            <p>Test gönderin ve teslim durumunu takip edin.</p>
          </div>
          <Badge
            color={
              serviceError || caps?.test_configured === false
                ? "amber"
                : caps
                  ? "teal"
                  : "gray"
            }
          >
            {serviceError
              ? "Bağlantı yok"
              : caps?.test_configured === false
                ? "Ayar gerekli"
                : caps
                  ? "Servis hazır"
                  : "Kontrol ediliyor"}
          </Badge>
        </div>
        <div className="notification-mode">
          <strong>
            {caps
              ? `${caps.mode.toUpperCase()} · Otomatik gerçek gönderim ${caps.automatic_enabled ? "açık" : "kapalı"}`
              : "Sunucu durumu kontrol ediliyor…"}
          </strong>
          <p>
            Otomatik bilgi e-postaları{" "}
            {caps?.automatic_enabled ? "etkin" : "kapalı"}. Manuel TEST,{" "}
            {date(testDate, true)} tarihli geçmiş raporu kendi doğrulanmış
            adresinize gönderir.
          </p>
        </div>
        <div className="test-mail-actions">
          <button
            className="btn btn-primary"
            disabled={!!disabledReason || sending}
            onClick={() => void sendTest()}
            aria-describedby="test-mail-help"
            aria-busy={sending}
          >
            {sending ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Send size={17} aria-hidden="true" />
            )}
            {sending ? "Gönderim kontrol ediliyor…" : "TEST e-postası gönder"}
          </button>
          <Link
            className="btn btn-white"
            to={`/alerts?mode=replay&event=${testDate}`}
          >
            Geçmiş raporu incele
          </Link>
        </div>
        <p id="test-mail-help" className="notification-help">
          {disabledReason ||
            "Etkin Akkuyu aboneliği ve açık bildirim onayı gerekir. Aynı olay bir kez gönderilir."}
        </p>
        {!session && authReady && (
          <Link className="text-link" to="/login">
            Giriş yap
          </Link>
        )}
        {session?.user.email && (
          <p className="test-recipient">
            Alıcı: <strong>{session.user.email}</strong>
            <Link className="text-link" to="/subscriptions">
              Bildirim iznini yönet
            </Link>
          </p>
        )}
        {serviceError && (
          <div className="notification-feedback error" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            <div>
              <p>{serviceError}</p>
              <button
                className="text-link"
                onClick={() => retryService((v) => v + 1)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Bağlantıyı yeniden dene
              </button>
            </div>
          </div>
        )}
        {feedback && feedback.owner === uid && (
          <div
            className={`notification-feedback ${feedback.failed ? "error" : "success"}`}
          >
            {feedback.failed ? (
              <TriangleAlert size={18} aria-hidden="true" />
            ) : (
              <CircleCheck size={18} aria-hidden="true" />
            )}
            <p>{feedback.text}</p>
          </div>
        )}
      </section>
      <section
        className="panel delivery-panel"
        aria-labelledby="delivery-title"
      >
        <div className="panel-head">
          <div>
            <h2 id="delivery-title">Kişisel bildirim geçmişi</h2>
            <p>
              Bu hesaba ait son 50 kayıt. Teslim sorgulamak yeni e-posta
              göndermez.
            </p>
          </div>
          {session && (
            <button
              className="btn btn-white"
              onClick={() => reload((v) => v + 1)}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Geçmişi yenile
            </button>
          )}
        </div>
        {!session ? (
          <p className="inline-empty">
            <Link className="text-link" to="/login">
              Bildirim geçmişi için giriş yapın.
            </Link>
          </p>
        ) : (
          <>
            {error && (
              <p className="inline-empty" role="alert">
                {error}
                <button
                  className="text-link"
                  onClick={() => reload((v) => v + 1)}
                >
                  Yeniden dene
                </button>
              </p>
            )}
            {!history.length && !error && (
              <p className="inline-empty">
                Bu görünümde hesabınıza ait kayıt yok.
              </p>
            )}
            {history.map((d) => (
              <div className="delivery-entry" key={`${uid}-${d.id}`}>
                <button
                  className="delivery-row"
                  disabled={!d.alerts?.report}
                  onClick={() => d.alerts && select(d.alerts.report)}
                >
                  <span>{date(d.created_at)}</span>
                  <strong>
                    {d.dispatch_mode === "test"
                      ? "TEST · geçmiş rapor"
                      : d.dispatch_mode === "shadow"
                        ? "Shadow provası"
                        : "Gözlem bilgi bildirimi"}
                  </strong>
                  <Badge color={d.status === "sent" ? "teal" : "gray"}>
                    {deliveryLabels[d.status] || d.status}
                  </Badge>
                </button>
                {d.status === "sent" && (
                  <DeliveryStatus id={d.id} token={session.access_token} />
                )}
              </div>
            ))}
          </>
        )}
      </section>
      {selected && owner === uid && (
        <ReportModal report={selected} close={() => select(null)} />
      )}
    </>
  );
}
