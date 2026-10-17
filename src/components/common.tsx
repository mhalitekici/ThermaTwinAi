import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FlaskConical,
  HelpCircle,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Waves,
  X,
} from "lucide-react";
import type { Report, Risk } from "../lib";
import { date, temp } from "../lib";
import { useApp } from "../context";
import { isStale } from "../science";
const SeaMap = lazy(() => import("../SeaMap"));
export function AppLink({ to, ...props }: LinkProps) {
  const { search } = useLocation();
  const target =
    typeof to === "string" &&
    to.startsWith("/") &&
    !to.includes("?") &&
    to !== "/" &&
    to !== "/login"
      ? to + search
      : to;
  return <Link to={target} {...props} />;
}
export function Logo() {
  return (
    <Link to="/" className="brand" aria-label="ThermaTwin AI ana sayfa">
      <span className="brand-icon">
        <Waves size={25} />
      </span>
      <span>
        ThermaTwin <b>AI</b>
        <small>OCEAN INTELLIGENCE</small>
      </span>
    </Link>
  );
}
export function Badge({
  children,
  color = "teal",
}: {
  children: ReactNode;
  color?: string;
}) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function RiskBadge({ risk }: { risk: Risk }) {
  const Icon = risk === "normal" ? ShieldCheck : TriangleAlert;
  return (
    <span className={`risk-badge ${risk}`}>
      <Icon size={15} />
      {
        {
          normal: "Normal",
          watch: "Dikkat",
          high: "Yüksek inceleme önceliği",
          unknown: "Veri yetersiz",
        }[risk]
      }
    </span>
  );
}
export function HelpTip({
  text,
  label = "Açıklama",
}: {
  text: string;
  label?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="help-tip">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
      >
        <HelpCircle size={15} />
      </button>
      {open && (
        <span className="tip-content" id={id} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
export function ThemeToggle() {
  const { theme, setTheme } = useApp();
  return (
    <button
      className="icon-button"
      aria-label={theme === "light" ? "Koyu temaya geç" : "Açık temaya geç"}
      title={theme === "light" ? "Koyu tema" : "Açık tema"}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  );
}
export function MapPanel({ large = false }: { large?: boolean }) {
  const { snap } = useApp();
  return (
    <Suspense
      fallback={
        <div
          className="map-loading skeleton"
          role="status"
          aria-label="Harita yükleniyor"
        />
      }
    >
      <SeaMap snapshot={snap} large={large} />
    </Suspense>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 tabIndex={-1} id="page-title">
          {title}
        </h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
export function ModeNotice() {
  const { mode, snap, loading, error, refresh, setMode } = useApp();
  if (error)
    return (
      <div className="notice error" role="alert">
        <TriangleAlert size={20} />
        <div>
          <strong>Veri yüklenemedi</strong>
          <span>{error}</span>
        </div>
        <button className="btn btn-white" onClick={refresh}>
          <RefreshCw size={15} />
          Yeniden dene
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="notice loading" role="status">
        <RefreshCw size={17} />
        <span>Doğrulanmış gözlemler yükleniyor…</span>
      </div>
    );
  if (!snap)
    return (
      <div className="notice">
        <Database size={20} />
        <div>
          <strong>Henüz gözlem verisi yok</strong>
          <span>
            Kaynak dosyasını yenileyin veya gerçek bir geçmiş olayı inceleyin.
          </span>
        </div>
        <button className="btn btn-white" onClick={() => setMode("replay")}>
          Geçmiş olayı aç <ArrowRight size={15} />
        </button>
      </div>
    );
  if (mode === "replay")
    return (
      <div className="notice replay">
        <FlaskConical size={20} />
        <div>
          <strong>Geçmiş olay tekrarı · {date(snap.origin_date, true)}</strong>
          <span>
            Akkuyu · Gerçek {snap.source.provider} verisi. Güncel uyarı
            değildir.
          </span>
        </div>
        <button className="btn btn-white" onClick={() => setMode("live")}>
          Son gözleme dön <ArrowRight size={15} />
        </button>
      </div>
    );
  if (isStale(snap))
    return (
      <div className="notice warning">
        <Clock3 size={20} />
        <div>
          <strong>Veri gecikmiş olabilir</strong>
          <span>
            Son gözlem {date(snap.origin_date, true)}. Tahminler bu tarihten
            başlar; bugünün tahmini olarak yorumlamayın.
          </span>
        </div>
      </div>
    );
  return (
    <div className="data-line">
      <span>
        <span className="pulse-dot" />
        {snap.source.provider} · Günlük uydu analizi
      </span>
      <span>
        Son kontrol:{" "}
        {new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/Moscow",
        }).format(new Date(snap.checked_at))}{" "}
        <small>UTC+3</small>
      </span>
    </div>
  );
}
export function DashboardSkeleton() {
  return (
    <div
      aria-label="Dashboard yükleniyor"
      role="status"
      aria-busy="true"
      className="dashboard-skeleton"
    >
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Database size={26} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function AuthEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="panel">
      <EmptyState title={title} description={description}>
        <Link className="btn btn-primary" to="/login">
          Giriş ekranını incele <ArrowRight size={16} />
        </Link>
      </EmptyState>
    </section>
  );
}
export function ReportRow({
  report,
  onClick,
}: {
  report: Report;
  onClick: () => void;
}) {
  return (
    <button className="report-row" onClick={onClick}>
      <span className={`report-icon ${report.facts.risk}`}>
        <Activity size={20} />
      </span>
      <span className="report-title">
        <strong>
          {report.facts.kind === "observed"
            ? "Gözlemlenen sıcaklık anomalisi"
            : "Tahmin edilen eşik aşımı"}
        </strong>
        <small>{date(report.facts.event_date, true)} · Akkuyu açıkları</small>
      </span>
      <RiskBadge risk={report.facts.risk} />
      <span className="report-number">{temp(report.facts.sst_c)} °C</span>
      <ChevronRight size={18} />
    </button>
  );
}
export function ReportModal({
  report,
  close,
}: {
  report: Report;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  function download() {
    const url = URL.createObjectURL(
      new Blob([report.text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ThermaTwin_${report.facts.event_date}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <dialog
      ref={ref}
      className="report-modal"
      aria-labelledby="report-heading"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <Badge color="blue">ANALİZ RAPORU</Badge>
        <button
          className="icon-button"
          aria-label="Raporu kapat"
          onClick={close}
        >
          <X size={21} />
        </button>
      </div>
      <h2 id="report-heading">Akkuyu termal gözlem raporu</h2>
      <p className="muted">
        {date(report.facts.event_date, true)} ·{" "}
        {report.method === "template"
          ? "Veriye dayalı şablon rapor"
          : "Sınırlı AI yorum seçimi"}
      </p>
      <pre>{report.text}</pre>
      <div className="modal-footer">
        <span>
          <ShieldCheck size={16} /> Sayısal değerler veri pipeline’ından gelir.
        </span>
        <button className="btn btn-primary" onClick={download}>
          <ArrowDownToLine size={16} />
          Raporu indir
        </button>
      </div>
    </dialog>
  );
}
export function SourceFootnote() {
  return (
    <p className="source-footnote">
      <Check size={15} /> Günlük bölgesel deniz yüzeyi analizi. Santral etkisi
      veya biyolojik zarar kanıtı değildir.
    </p>
  );
}
