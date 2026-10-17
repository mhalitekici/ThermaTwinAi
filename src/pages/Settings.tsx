import { AppLink as Link } from "../components/common";

import { ArrowRight, Database, Moon, Sun } from "lucide-react";
import { useApp } from "../context";
import { date, integrationsEnabled, integrationError } from "../lib";
import { Badge, PageHead } from "../components/common";
export default function Settings() {
  const { theme, setTheme, snap, notify, session, signOut } = useApp();
  return (
    <>
      <PageHead
        eyebrow="ÇALIŞMA ALANI AYARLARI"
        title="Size uygun bir görünüm."
        description="Görünümü kişiselleştirin; veri kaynağını, hesap durumunu ve bilimsel sınırları inceleyin."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Görünüm</h2>
          <p>Tema tercihiniz bu tarayıcıda saklanır.</p>
          <div className="theme-options">
            {(["light", "dark"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={theme === value}
                className={`${value} ${theme === value ? "selected" : ""}`}
                onClick={() => setTheme(value)}
              >
                <span className="theme-preview">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {value === "light" ? <Sun size={17} /> : <Moon size={17} />}{" "}
                  {value === "light" ? "Açık tema" : "Koyu tema"}
                </span>
              </button>
            ))}
          </div>
          <div className="settings-row">
            <div>
              <strong>Dil ve gösterim</strong>
              <span>Türkçe · Celsius (°C) · Kontrol saati UTC+3</span>
            </div>
            <Badge color="gray">TR</Badge>
          </div>
        </section>
        <section className="panel settings-card">
          <h2>Veri kaynağı</h2>
          <p>
            <Database size={16} />
            Copernicus Marine · Günlük uydu analizi
          </p>
          <dl>
            <div>
              <dt>Son gözlem</dt>
              <dd>{date(snap?.origin_date, true)}</dd>
            </div>
            <div>
              <dt>Veri çözünürlüğü</dt>
              <dd>{snap?.source.resolution ?? "~1 km"}</dd>
            </div>
            <div>
              <dt>Çalışma alanı</dt>
              <dd>Yalnız Akkuyu açıkları</dd>
            </div>
            <div>
              <dt>Veri güncellemesi</dt>
              <dd>Tarihi belirtilmiş gözlem kaydı</dd>
            </div>
          </dl>
          {snap && (
            <a
              href={snap.source.catalog_url}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Resmî veri kataloğunu aç <ArrowRight size={15} />
            </a>
          )}
        </section>
        <section className="panel settings-card">
          <h2>Model ve şeffaflık</h2>
          <p>
            Gerçek test hataları, persistence karşılaştırması, veri kalite
            kontrolleri ve tahmin aralıkları.
          </p>
          <Link className="btn btn-white" to="/performance">
            Model performansını incele <ArrowRight size={16} />
          </Link>
        </section>
        <section className="panel settings-card">
          <div className="setting-heading">
            <h2>Canlı entegrasyonlar</h2>
            <Badge color="gray">
              {integrationsEnabled ? "PRODUCTION BAĞLANTISI" : "DEMO"}
            </Badge>
          </div>
          <p>
            {integrationsEnabled
              ? integrationError ||
                "E-posta koduyla giriş ve kişisel abonelik yönetimi. Otomatik bildirimler, sunucu izni olmadan gönderilmez."
              : "Demo tercihleri bu tarayıcıdadır. Hesap ve gerçek e-posta bağlantısı kapalıdır."}
          </p>
          <button
            className="text-link"
            onClick={() => {
              try {
                localStorage.removeItem("thermatwin-local-watch");
                notify("Yerel izleme tercihi temizlendi.");
              } catch {
                notify("Tarayıcı yerel kayıt alanına erişilemiyor.");
              }
            }}
          >
            Yerel izleme tercihini temizle <ArrowRight size={15} />
          </button>
          {session && (
            <>
              <p>{session.user.email}</p>
              <button className="btn btn-white" onClick={() => void signOut()}>
                Çıkış yap
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
