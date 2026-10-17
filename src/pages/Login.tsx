import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, ShieldCheck, Waves } from "lucide-react";
import type { FormEvent } from "react";
import { integrationError, supabase } from "../lib";
import { authError, emailOtpInput, emailOtpPattern } from "../auth";
import { useApp } from "../context";
import { Logo, Badge } from "../components/common";

export default function Login() {
  const { session, notify } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (session) navigate("/subscriptions", { replace: true });
  }, [session, navigate]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase || busy || cooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) setError(authError(error));
      else {
        setStep("otp");
        setEmail(email.trim().toLowerCase());
        setCooldown(60);
        notify("Doğrulama kodu istendi. Gelen kutunuzu kontrol edin.");
      }
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy || !emailOtpPattern.test(code)) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (error) setError(authError(error));
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Logo />
        <div>
          <Badge>DENİZİ BİRLİKTE ANLAYALIM</Badge>
          <h1>
            Değişimi takip edin.
            <br />
            <em>Bir adım önde olun.</em>
          </h1>
          <p>
            Deniz sıcaklığı gözlemlerini, kısa vadeli tahminleri ve anlaşılır
            raporları tek bir yerde buluşturun.
          </p>
          <div className="login-wave">
            <Waves size={130} strokeWidth={0.65} />
          </div>
        </div>
        <span className="fine-print">ThermaTwin AI · Climathon 2026</span>
      </div>
      <main className="login-form-area">
        <Link className="back-link" to="/dashboard">
          ← Gözlem merkezine dön
        </Link>
        <div className="login-form">
          <div className="empty-icon">
            <Mail size={27} />
          </div>
          <h2>
            {step === "email"
              ? "Gözlem ağınıza katılın"
              : "E-postanızı doğrulayın"}
          </h2>
          <p>
            {step === "email"
              ? "Şifresiz, güvenli giriş. E-postanıza bir doğrulama kodu göndereceğiz."
              : `${email} adresine gönderilen kodu eksiksiz girin.`}
          </p>
          {!supabase && (
            <div className="notice">
              <div>
                <strong>
                  {integrationError || "Yerel prototip · giriş kapalı"}
                </strong>
                <span>
                  Bu aşamada hesap açılmaz ve doğrulama e-postası gönderilmez.
                  Gözlemler ve geçmiş olaylar giriş gerektirmeden incelenebilir.
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={step === "email" ? send : verify}>
            {step === "email" ? (
              <>
                <label htmlFor="email">E-posta adresi</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  spellCheck={false}
                  placeholder="adiniz@ornek.com"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            ) : (
              <>
                <label htmlFor="otp">Doğrulama kodu</label>
                <input
                  id="otp"
                  name="otp"
                  spellCheck={false}
                  className="otp-input"
                  inputMode="numeric"
                  {...emailOtpInput}
                  autoComplete="one-time-code"
                  placeholder="Kodunuz"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </>
            )}
            <button
              className="btn btn-primary full"
              disabled={!supabase || busy}
            >
              {busy
                ? "İşleniyor…"
                : step === "email"
                  ? "Doğrulama kodu gönder"
                  : "Doğrula ve devam et"}
              <ArrowRight size={17} />
            </button>
          </form>
          {step === "otp" && (
            <div className="otp-actions">
              <button
                className="text-link"
                disabled={cooldown > 0 || busy}
                onClick={() => void send()}
              >
                {cooldown
                  ? `Yeniden gönder (${cooldown}s)`
                  : "Kodu yeniden gönder"}
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setCooldown(0);
                }}
              >
                E-postayı değiştir
              </button>
            </div>
          )}
          <div className="login-security">
            <ShieldCheck size={16} /> Kodunuzu kimseyle paylaşmayın.
          </div>
        </div>
      </main>
    </div>
  );
}
