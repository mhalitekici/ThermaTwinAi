import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  Database,
  FlaskConical,
  Layers3,
  MapPin,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { Logo, ThemeToggle } from "../components/common";
import { date, readSnapshot, temp } from "../lib";
import type { Snapshot } from "../lib";
import { isStale } from "../science";

type Evidence = {
  version: string;
  created_at: string;
  rolling_pooled: Record<
    string,
    { n: number; model: { mae_c: number }; mae_improvement_pct: number }
  >;
  checks: { rolling_folds: number };
};
const steps = [
  {
    icon: Database,
    title: "Gözlemle",
    text: "Copernicus Marine günlük uydu analizinden bölgesel deniz yüzeyi sıcaklığını oku.",
  },
  {
    icon: Layers3,
    title: "Analiz et",
    text: "Gözlemi, eğitim döneminden dondurulmuş mevsimsel referans ve P90 eşiğiyle karşılaştır.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Tahmin et",
    text: "Son gözlemden 24, 48 ve 72 saat sonrasını, geçmiş hatalardan hesaplanan aralıklarla incele.",
  },
  {
    icon: ShieldCheck,
    title: "Açıkla",
    text: "Sonucun tarihini, kaynağını ve sınırlarını gör. Gözlem ile öngörüyü birbirinden ayır.",
  },
];
const capabilities = [
  {
    path: "/regions",
    icon: MapPin,
    title: "Gerçek coğrafi bağlam",
    text: "Akkuyu izleme alanı, gerçek harita ve açıkça belirtilen mekânsal sınırlar.",
  },
  {
    path: "/forecasts",
    icon: ChartNoAxesCombined,
    title: "Üç ufuk, görünür belirsizlik",
    text: "Nokta tahmini, alt–üst aralık ve tarih. Sıcaklık değişimi ile olay olasılığı aynı şey değildir.",
  },
  {
    path: "/alerts",
    icon: Bell,
    title: "Ölçülü anomali incelemesi",
    text: "Gözlenmiş P90 aşımı ile tahmin sinyali ayrı. Bir eşik aşımı zarar veya acil durum kanıtı değildir.",
  },
];
const faqs = [
  [
    "Bu veri anlık bir sensör ölçümü mü?",
    "Hayır. Günlük uydu analizinden, kara maskesi uygulanarak hesaplanan bölgesel ortalamadır. Kıyıda tek noktayı veya gün içindeki değişimi temsil etmez.",
  ],
  [
    "Tahmin aralığı ne anlatır?",
    "Ayrı kalibrasyon dönemindeki hatalardan hesaplanan bir sıcaklık aralığıdır. Olay olasılığı veya belirli bir gün için garanti değildir; hızlı ısınmalarda kapsama düşer.",
  ],
  [
    "Bir anomali, çevresel zarar anlamına gelir mi?",
    "Hayır. Eğitim döneminden belirlenen mevsimsel P90 eşiğinin aşılması bir inceleme sinyalidir. Tesis kaynaklı etkiyi, ekolojik zararı veya bir acil durumu kanıtlamaz.",
  ],
  [
    "Hangi bölgeyi inceleyebilirim?",
    "Mevcut kapsam Akkuyu açıklarında 35,95–36,15° kuzey ve 33,40–33,70° doğu sınırları arasındaki deniz alanıdır. Diğer bölgelere genelleme doğrulanmamıştır.",
  ],
  [
    "E-posta bildirimi nasıl çalışır?",
    "Doğrulanmış hesabınızdan tercihlerinizi yönetebilirsiniz. Manuel TEST yalnız kendi adresinize, açık onay ve tekrar engeliyle gönderilir. Otomatik ve deneysel tahmin e-postaları ayrıca izin verilmeden açılmaz.",
  ],
];
export default function Landing() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [cases, setCases] = useState<Snapshot[]>([]);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    document.title =
      "ThermaTwin AI | Ocean Intelligence & Predictive Thermal Analytics";
    let active = true;
    void readSnapshot("live")
      .then((value) => {
        if (active) {
          setSnapshot(value);
          setFailed(!value);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    void fetch("/reliability-report.json")
      .then((r) => {
        if (!r.ok) throw new Error("report");
        return r.json();
      })
      .then((value: Evidence) => {
        if (active && value.rolling_pooled && value.checks) setEvidence(value);
      })
      .catch(() => {
        /* No substitute metrics. */
      });
    void fetch("/reliability-replays.json")
      .then((r) => {
        if (!r.ok) throw new Error("replay");
        return r.json();
      })
      .then((value: { events: Snapshot[] }) => {
        if (active) setCases(value.events || []);
      })
      .catch(() => {
        /* No invented examples. */
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <div className="landing ocean-product">
      <a className="skip-link" href="#landing-content">
        İçeriğe geç
      </a>
      <nav className="landing-nav" aria-label="Ürün gezinmesi">
        <Logo />
        <div className="landing-navigation">
          <a href="#approach">Nasıl çalışır?</a>
          <Link to="/performance">Model Performansı</Link>
          <ThemeToggle />
          <Link to="/login" className="btn btn-outline-light">
            Giriş yap <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </nav>
      <main id="landing-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-copy">
            <span className="ocean-location">
              <MapPin size={16} aria-hidden="true" /> Akkuyu açıkları / Doğu
              Akdeniz
            </span>
            <h1 id="landing-title">
              Denizin yarınını,
              <br />
              bugünden anlayın.
            </h1>
            <p>
              Uydu tabanlı deniz sıcaklığı gözlemleri, kısa vadeli tahminler ve
              görünür belirsizlik. Deniz değişirken, veriye dayanarak düşünün.
            </p>
            <div className="hero-buttons">
              <Link className="btn btn-primary" to="/dashboard">
                Canlı gözlemleri keşfet{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="hero-secondary" to="/performance">
                Model performansını incele{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className="hero-footnote">
              Günlük uydu analizi. Kaynağı ve tarihi belli sonuçlar.
              <br />
              Anlık sensör ağı veya garantili erken uyarı değildir.
            </p>
          </div>
          <div className="ocean-observation">
            <svg
              className="ocean-contour-art"
              viewBox="0 0 600 550"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="ocean-glow">
                  <stop stopColor="#12C6C8" stopOpacity=".16" />
                  <stop offset="1" stopColor="#12C6C8" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="600" height="550" fill="url(#ocean-glow)" />
              {Array.from({ length: 18 }, (_, i) => (
                <path
                  key={i}
                  d={`M${-190 + i * 27} 570 C ${150 + i * 10} ${285 - i * 13}, ${340 + i * 8} ${430 - i * 12}, ${210 + i * 29} -30`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={i % 4 === 0 ? 1.3 : 0.6}
                />
              ))}
              <path
                d="M25 190H575M300 35V510"
                stroke="currentColor"
                strokeDasharray="3 9"
                opacity=".4"
              />
              <circle cx="300" cy="190" r="8" fill="#68DDC6" />
              <circle
                cx="300"
                cy="190"
                r="26"
                fill="none"
                stroke="#68DDC6"
                opacity=".5"
              />
            </svg>
            <div className="ocean-coordinate">
              <span>36,05° N / 33,55° E</span>
              <strong>Akkuyu açıkları</strong>
            </div>
            <div className="landing-observation-card" aria-live="polite">
              {snapshot ? (
                <>
                  <div className="observation-card-heading">
                    <span>Son kayıtlı gözlem</span>
                    <span
                      className={`observation-state ${isStale(snapshot) ? "delayed" : ""}`}
                    >
                      {isStale(snapshot)
                        ? "Veri gecikmiş"
                        : "Tarihli günlük veri"}
                    </span>
                  </div>
                  <div className="landing-sst">
                    {temp(snapshot.observation.sst_c)}
                    <small>°C</small>
                  </div>
                  <p>
                    {date(snapshot.origin_date, true)}
                    <br />
                    <span>
                      {snapshot.source.provider} / {snapshot.source.resolution}
                    </span>
                  </p>
                  <dl className="landing-observation-details">
                    <div>
                      <dt>Mevsimsel referans</dt>
                      <dd>{temp(snapshot.observation.reference_c)} °C</dd>
                    </div>
                    <div>
                      <dt>Referanstan fark</dt>
                      <dd>
                        {snapshot.observation.anomaly_c >= 0 ? "+" : ""}
                        {temp(snapshot.observation.anomaly_c)} °C
                      </dd>
                    </div>
                  </dl>
                  <Link to="/dashboard">
                    Kaydı ve tahmin başlangıcını incele{" "}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <div className="landing-data-empty">
                  <Waves size={32} aria-hidden="true" />
                  <h2>
                    {failed ? "Gözleme erişilemiyor" : "Gözlem yükleniyor…"}
                  </h2>
                  <p>Ölçüm olmadan sıcaklık veya tahmin gösterilmez.</p>
                  {failed && (
                    <button
                      className="btn btn-white"
                      onClick={() => {
                        setFailed(false);
                        setRevision((v) => v + 1);
                      }}
                    >
                      Yeniden dene
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="contour-caption">
              Kontur çizimleri illüstrasyondur; ölçülmüş ısı veya batimetri
              haritası değildir.
            </span>
          </div>
        </section>
        <div className="source-ribbon">
          <span>
            <Database size={17} aria-hidden="true" /> Copernicus Marine
          </span>
          <span>Günlük bölgesel SST</span>
          <span>24 / 48 / 72 saat</span>
          <span>Kaynağı açık. Sınırları görünür.</span>
        </div>
        <section
          id="approach"
          className="ocean-section"
          aria-labelledby="approach-title"
        >
          <div className="section-intro">
            <div>
              <span className="section-kicker">Veriden karara</span>
              <h2 id="approach-title">
                Her sonucun arkasında
                <br />
                izlenebilir bir yöntem.
              </h2>
            </div>
            <p>
              ThermaTwin Forecasting Engine; XGBoost, basit referans modeller ve
              ayrı kalibrasyonla çalışır. Modelin neyi bildiği kadar, nerede
              zorlandığını da gösterir.
            </p>
          </div>
          <div className="method-grid">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <article key={title}>
                <span className="method-number">0{i + 1}</span>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="ocean-section capabilities"
          aria-labelledby="capabilities-title"
        >
          <div className="capability-copy">
            <span className="section-kicker">Aynı deniz. Farklı sorular.</span>
            <h2 id="capabilities-title">
              Gözlem, tahmin ve geçmiş.
              <br />
              Birbirine karışmadan.
            </h2>
            <p>
              Son gözlem ile geleceğe ait hesapları ayrı görün. Kaynak
              geciktiğinde tarihi saklamayız; güncel olmayan veri yeni uyarı
              olarak sunulmaz.
            </p>
            <Link className="btn btn-white" to="/dashboard">
              Gözlem merkezini aç <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="capability-links">
            {capabilities.map(({ path, icon: Icon, title, text }) => (
              <Link key={path} to={path}>
                <Icon size={24} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
        <section
          className="ocean-section landing-evidence"
          aria-labelledby="evidence-title"
        >
          <div className="section-intro">
            <div>
              <span className="section-kicker">
                ThermaTwin AI Performance Lab
              </span>
              <h2 id="evidence-title">
                İddia değil,
                <br />
                ölçülmüş performans.
              </h2>
            </div>
            <p>
              2019–2026 geçmiş değerlendirmesi. Yıllık genişleyen eğitim; ayrı
              validation, kalibrasyon ve test. Genel bir “AI doğruluğu” yüzdesi
              kullanmıyoruz.
            </p>
          </div>
          {evidence ? (
            <>
              <div className="evidence-grid">
                {[1, 2, 3].map((h) => {
                  const item = evidence.rolling_pooled[String(h)];
                  return (
                    item && (
                      <article key={h}>
                        <span>+{h * 24} saat / ortalama mutlak hata</span>
                        <strong>
                          {temp(item.model.mae_c, 4)} <small>°C</small>
                        </strong>
                        <p>
                          Persistence MAE’sine göre %
                          {temp(item.mae_improvement_pct, 2)} azalma
                        </p>
                        <small>
                          {new Intl.NumberFormat("tr-TR").format(item.n)}{" "}
                          eşleşmiş tahmin / gözlem
                        </small>
                      </article>
                    )
                  );
                })}
              </div>
              <p className="evidence-provenance">
                Kaynak: {evidence.version} · {evidence.checks.rolling_folds}{" "}
                yıllık test bloğu · Değerlendirme{" "}
                {date(evidence.created_at?.slice(0, 10), true)}. Bu kazanç
                anomali tespit doğruluğu değildir.
              </p>
            </>
          ) : (
            <p className="small-notice">
              Sayısal değerlendirme burada yüklenemedi. Kaynak raporu
              Performance Lab’de inceleyebilirsiniz; yerine tahmini bir değer
              gösterilmez.
            </p>
          )}
          <div className="evidence-limit">
            <ShieldCheck size={24} aria-hidden="true" />
            <p>
              Sıcaklık hatası persistence’tan daha düşük; mevcut uyarı
              stratejisinin F1 skoru ise daha iyi değil. Ani ısınmada
              belirsizlik aralıkları yetersiz kalabiliyor.
            </p>
            <Link className="text-link" to="/performance">
              Tüm sonuçlar ve sınırlamalar{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="ocean-section" aria-labelledby="cases-title">
          <div className="section-intro">
            <div>
              <span className="section-kicker">Geçmişi birlikte okuyun</span>
              <h2 id="cases-title">
                İşe yarayan sinyal de,
                <br />
                yanılan tahmin de görünür.
              </h2>
            </div>
            <p>
              Seçilmiş örnekler toplam başarı oranını temsil etmez. Her iki
              gerçek örnek de aynı kayıtlı değerlendirmeden gelir.
            </p>
          </div>
          <div className="landing-case-grid">
            {cases.map((event) => (
              <Link
                key={event.origin_date}
                to={`/history?mode=replay&event=${event.origin_date}`}
              >
                <span className="case-type">
                  <FlaskConical size={18} aria-hidden="true" /> Geçmiş olay
                  tekrarı
                </span>
                <h3>{event.replay_label || date(event.origin_date, true)}</h3>
                <p>{event.replay_assessment}</p>
                <span>
                  {date(event.origin_date, true)}{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
          {!cases.length && (
            <Link className="text-link" to="/history">
              Gerçek geçmiş olayları incele{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>
        <section
          className="ocean-section method-limitations"
          aria-labelledby="limits-title"
        >
          <div>
            <span className="section-kicker">Bilimsel sınırlar</span>
            <h2 id="limits-title">
              Deniz karmaşık.
              <br />
              Sonuçlarımız ölçülü.
            </h2>
            <a
              className="text-link"
              href="https://data.marine.copernicus.eu/product/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004/services"
              target="_blank"
              rel="noreferrer"
            >
              Resmî veri kaynağını incele{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <ul>
            <li>
              Günlük, bölgesel uydu analizi; anlık kıyı sensörü veya tesis
              deşarj modeli değil.
            </li>
            <li>
              Mevsimsel referans eğitim döneminden gelir; standart 30 yıllık
              klimatoloji değildir.
            </li>
            <li>
              Geçmiş değerlendirme, bağımsız ileriye dönük saha doğrulamasının
              yerini tutmaz.
            </li>
            <li>
              Verinin yayın gecikmesi ve arşiv revizyonları operasyonel
              kullanımı sınırlar.
            </li>
            <li>
              Bir sıcaklık anomalisi, tesis etkisini veya ekolojik zararı tek
              başına kanıtlamaz.
            </li>
          </ul>
        </section>
        <section className="ocean-section notification-invitation">
          <Bell size={30} aria-hidden="true" />
          <div>
            <h2>Takibiniz sizin kontrolünüzde.</h2>
            <p>
              Doğrulanmış hesabınızla bölge tercihlerinizi yönetin. Bildirimler
              açık onaya bağlıdır; otomatik gönderimler ayrıca
              yetkilendirilmeden açılmaz.
            </p>
          </div>
          <Link className="btn btn-primary" to="/subscriptions">
            Bildirim tercihleri <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
        <section
          className="ocean-section landing-faq"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="section-kicker">Açık sorular, açık yanıtlar</span>
            <h2 id="faq-title">Bilmeniz gerekenler.</h2>
          </div>
          <div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Logo />
          <p>Ocean Intelligence &amp; Predictive Thermal Analytics</p>
          <span>Deniz verisinden, ölçülü içgörüye.</span>
        </div>
        <nav aria-label="Alt ürün gezinmesi">
          <Link to="/dashboard">Gözlem merkezi</Link>
          <Link to="/performance">Model Performansı</Link>
          <Link to="/history">Geçmiş analiz</Link>
          <Link to="/subscriptions">Bildirimler</Link>
        </nav>
        <p>
          Veri: Copernicus Marine. Harita kaynakları uygulama içinde belirtilir.
          Araştırma temelli bir inceleme aracıdır; çevresel etki kanıtı veya
          acil durum hizmeti değildir.
        </p>
      </footer>
    </div>
  );
}
