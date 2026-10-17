import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  FlaskConical,
  Globe2,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Radio,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useApp } from "../context";
import { Logo, ThemeToggle } from "./common";
import { integrationsEnabled } from "../lib";
import Dashboard from "../pages/Dashboard";
import Regions from "../pages/Regions";
import Forecasts from "../pages/Forecasts";
import HistoryPage from "../pages/History";
import Settings from "../pages/Settings";
import Performance from "../pages/Performance";
import Subscriptions from "../pages/Subscriptions";
import Alerts from "../pages/Alerts";
const items = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Genel bakış" },
  { path: "/regions", icon: Globe2, label: "Deniz izleme" },
  { path: "/forecasts", icon: ChartNoAxesCombined, label: "AI tahminleri" },
  { path: "/alerts", icon: Bell, label: "Anomali uyarıları" },
  { path: "/history", icon: History, label: "Geçmiş analiz" },
  { path: "/subscriptions", icon: Radio, label: "Abonelikler" },
];
export default function Shell() {
  const { mode, setMode, session, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const sidebar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const current =
    items.find((i) => location.pathname === i.path)?.label ??
    (location.pathname === "/performance" ? "Model performansı" : "Ayarlar");
  useEffect(() => {
    document.title = `${current} · ThermaTwin AI`;
  }, [current]);
  useEffect(() => {
    if (!open) return;
    const bodyElement = body.current;
    bodyElement?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sidebar.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => menu.current?.focus());
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>("a,button") ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      bodyElement?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => menu.current?.focus());
  }
  const suffix = location.search;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <aside
        ref={sidebar}
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Ana menü"
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="mobile-close icon-button"
            aria-label="Menüyü kapat"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-tag">
          <span className="workspace-initial">A</span>
          <span>
            Akkuyu çalışma alanı<small>Climathon 2026 · Pilot</small>
          </span>
          <span className="pilot-dot" />
        </div>
        <span className="nav-label">ÇALIŞMA ALANI</span>
        <nav>
          {items.map((n) => (
            <NavLink
              key={n.path}
              to={n.path + suffix}
              onClick={() => setOpen(false)}
            >
              <n.icon size={19} />
              {n.label}
              {n.path === "/history" && <span className="nav-tag">DEMO</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-demo">
          <FlaskConical size={20} />
          <strong>Veriyi bir hikâyeye dönüştürün.</strong>
          <p>Gerçek bir sıcak olayı geçmiş verilerle adım adım inceleyin.</p>
          <button
            onClick={() => {
              navigate("/history" + suffix);
              setOpen(false);
            }}
          >
            Geçmiş olayı keşfet <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <NavLink
            className="settings-nav"
            to={"/settings" + suffix}
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            Ayarlar
          </NavLink>
          <div className="local-profile">
            <span>TT</span>
            <div>
              <strong>
                {integrationsEnabled
                  ? session
                    ? "Doğrulanmış hesap"
                    : "Bağlı çalışma alanı"
                  : "Yerel çalışma alanı"}
              </strong>
              <small>
                {integrationsEnabled
                  ? "Supabase · Kişisel tercihler"
                  : "Canlı bağlantılar kapalı"}
              </small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="mobile-overlay"
          onClick={close}
          aria-label="Menüyü kapat"
          tabIndex={-1}
        />
      )}
      <div className="app-body" ref={body}>
        <header className="topbar">
          <div className="topbar-location">
            <button
              ref={menu}
              className="mobile-menu icon-button"
              aria-label="Menüyü aç"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Çalışma alanı</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <div
              className="mode-switch"
              role="group"
              aria-label="Veri görünümü"
            >
              <button
                aria-pressed={mode === "live"}
                className={mode === "live" ? "active" : ""}
                onClick={() => setMode("live")}
              >
                <span className="pulse-dot" />
                Son gözlem
              </button>
              <button
                aria-pressed={mode === "replay"}
                className={mode === "replay" ? "active replay-active" : ""}
                onClick={() => setMode("replay")}
              >
                <History size={14} />
                Geçmiş tekrar
              </button>
            </div>
            <ThemeToggle />
            {integrationsEnabled &&
              (session ? (
                <button
                  className="btn btn-white account-button"
                  aria-label="Çıkış yap"
                  onClick={() => void signOut()}
                >
                  <LogOut size={17} aria-hidden="true" />
                  <span>Çıkış</span>
                </button>
              ) : (
                <Link
                  className="btn btn-white account-button"
                  to="/login"
                  aria-label="Giriş yap"
                >
                  <LogIn size={17} aria-hidden="true" />
                  <span>Giriş</span>
                </Link>
              ))}
            <Link
              className="icon-button"
              to={"/alerts" + suffix}
              aria-label="Uyarıları aç"
            >
              <Bell size={19} />
            </Link>
          </div>
        </header>
        <main id="main-content" className="workspace">
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="regions" element={<Regions />} />
            <Route path="forecasts" element={<Forecasts />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="performance" element={<Performance />} />
            <Route path="settings" element={<Settings />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="alerts" element={<Alerts />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Sayfa bulunamadı</h1>
                  <Link className="btn btn-primary" to="/dashboard">
                    Genel bakışa dön
                  </Link>
                </div>
              }
            />
          </Routes>
          <footer className="workspace-footer">
            <span>
              <WavesMark /> ThermaTwin AI <i /> Deniz verisinden anlaşılır
              içgörüye.
            </span>
            <span>Çevresel inceleme prototipi · Climathon 2026</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function WavesMark() {
  return <span aria-hidden="true">≈</span>;
}
