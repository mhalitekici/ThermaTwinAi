import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Database,
  FlaskConical,
  MapPin,
  Radio,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Logo, Badge } from "../components/common";

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div>
          <Link to="/dashboard">Platform</Link>
          <a href="#approach">Yaklaşımımız</a>
          <Link to="/login" className="btn btn-outline-light">
            Giriş yap <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
      <main className="landing-hero">
        <div className="hero-copy">
          <Badge>
            <span className="pulse-dot" /> AKDENİZ İÇİN GELİŞTİRİLDİ
          </Badge>
          <h1>
            Denizin değişimini
            <br />
            <em>önceden görün.</em>
          </h1>
          <p>
            Açık deniz verilerini anlaşılır bir erken uyarıya dönüştürüyoruz.
            Akkuyu kıyısında sıcaklığı izleyin, kısa vadeli tahminleri inceleyin
            ve değişimden haberdar olun.
          </p>
          <div className="hero-buttons">
            <Link className="btn btn-primary" to="/dashboard">
              Gözlem merkezini aç <ArrowRight size={18} />
            </Link>
            <Link className="btn btn-outline-light" to="/dashboard?mode=replay">
              <FlaskConical size={17} /> Gerçek geçmişi keşfet
            </Link>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={16} /> Açık kaynaklar. Görünür belirsizlik.
            Ölçülü sonuçlar.
          </div>
        </div>
        <div
          className="ocean-visual"
          aria-label="Deniz gözlem platformu görseli"
        >
          <div className="ocean-grid" />
          <svg viewBox="0 0 600 500" className="contours" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <path
                key={i}
                d={`M${-180 + i * 18} 520 C ${90 + i * 6} ${290 - i * 9}, ${380 + i * 18} ${410 - i * 18}, ${330 + i * 25} -30`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
          </svg>
          <div className="visual-top">
            <Radio size={16} /> DOĞU AKDENİZ <span>36.05° N · 33.55° E</span>
          </div>
          <div className="ocean-point">
            <span />
            <span />
            <MapPin size={24} />
            <label>AKKUYU</label>
          </div>
          <div className="visual-card">
            <span className="eyebrow">KIYI GÖZLEM AĞI / 01</span>
            <h3>Denizin referans davranışı.</h3>
            <p>Gözlem → Tahmin → Anomali → Uyarı</p>
            <div className="signal-line">
              <svg viewBox="0 0 300 45">
                <path
                  d="M0 34 L20 30 L35 34 L50 22 L65 26 L85 14 L100 20 L120 12 L140 16 L155 8 L170 14 L190 4 L210 10 L230 3 L250 12 L275 6 L300 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <small>Görsel şema · ölçüm grafiği değildir</small>
          </div>
          <div className="visual-bottom">
            <span className="pulse-dot" /> GÜNLÜK UYDU ANALİZİ{" "}
            <span>24 / 48 / 72 SAAT</span>
          </div>
        </div>
      </main>
      <section id="approach" className="approach">
        <div>
          <span className="eyebrow">VERİDEN İÇGÖRÜYE</span>
          <h2>
            Daha anlaşılır bir deniz.
            <br />
            Daha erken bir bakış.
          </h2>
        </div>
        <article>
          <Database />
          <h3>Geçmişi öğrenir</h3>
          <p>
            Günlük SST verisi ve mevsimsel referanslarla bölgenin termal
            geçmişini inceler.
          </p>
        </article>
        <article>
          <TrendingUp />
          <h3>Değişimi öngörür</h3>
          <p>
            XGBoost tahminlerini basit bir referans modelle karşılaştırır,
            belirsizliği gösterir.
          </p>
        </article>
        <article>
          <Bell />
          <h3>Takibi kolaylaştırır</h3>
          <p>
            İzleme aboneliklerini kısa ve veriye dayalı açıklamalı raporlarla
            birleştirir.
          </p>
        </article>
      </section>
      <footer className="landing-footer">
        <Logo />
        <span>Climathon 2026 · Akkuyu pilotu</span>
        <span>Çevresel inceleme prototipi · tesis etkisi kanıtı değildir.</span>
      </footer>
    </div>
  );
}
