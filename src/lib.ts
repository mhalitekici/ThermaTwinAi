import { createClient } from "@supabase/supabase-js";
import { isPublicSupabaseKey } from "./auth";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (key && !isPublicSupabaseKey(key))
  throw new Error(
    "İstemciye yalnız Supabase publishable/anon anahtarı verilebilir.",
  );
export const appMode =
  import.meta.env.VITE_APP_MODE ||
  (import.meta.env.VITE_ENABLE_LIVE_INTEGRATIONS === "true"
    ? "production"
    : "demo");
if (!["demo", "production"].includes(appMode))
  throw new Error("VITE_APP_MODE demo veya production olmalı.");
export const integrationsEnabled = appMode === "production";
export const integrationError =
  integrationsEnabled && (!url || !key)
    ? "Production modu için Supabase bağlantısı yapılandırılmamış."
    : "";
export const supabase =
  integrationsEnabled && url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "thermatwin-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export const api =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "/api");
export type Mode = "live" | "replay";
export type Risk = "normal" | "watch" | "high" | "unknown";
export interface WarningSignal {
  triggered: boolean;
  signal_c: number;
  threshold_c: number;
  percentile: number;
  source: string;
  margin_c: number;
  reason: string;
}
export interface EarlyWarning {
  state: "normal" | "observed_anomaly" | "forecast_risk" | "insufficient_data";
  reason: string;
  data_date: string;
  horizon_hours: number | null;
  notify: boolean;
  suppression_reason: string | null;
  alert_id: string | null;
  rule: string;
  policy_version: string;
}
export interface Forecast {
  horizon_days: number;
  origin_date: string;
  target_date: string;
  sst_c: number;
  lower_c: number;
  upper_c: number;
  reference_c: number;
  p90_c: number;
  risk: Risk;
  method: string;
  warning?: WarningSignal;
  interval?: {
    nominal_coverage: number;
    method: string;
    calibration_end: string;
    test_coverage: number;
  };
}
export interface Report {
  text: string;
  method: string;
  facts: {
    kind: "observed" | "predicted";
    event_date: string;
    risk: Risk;
    sst_c: number;
    reference_c: number;
  };
}
export interface Snapshot {
  status: "ready";
  mode: Mode;
  origin_date: string;
  checked_at: string;
  age_days: number;
  stale: boolean;
  region: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    south: number;
    north: number;
    west: number;
    east: number;
  };
  source: {
    provider: string;
    dataset_id: string;
    resolution: string;
    latitude?: number;
    longitude?: number;
    catalog_url: string;
    limitation?: string;
    first_observation: string;
    last_observation: string;
    valid_days: number;
    missing_days: number;
    retrieved_at: string;
    sha256?: string;
  };
  observation: {
    sst_c: number;
    reference_c: number;
    p90_c: number;
    anomaly_c: number;
    risk: Risk;
    duration_days: number;
    mhw: boolean;
  };
  forecasts: Forecast[];
  history: {
    date: string;
    sst_c: number | null;
    reference_c: number;
    p90_c: number;
    anomaly_c: number | null;
    duration_days: number;
    mhw: boolean;
  }[];
  reports: Report[];
  early_warning?: EarlyWarning;
  replay_label?: string;
  replay_assessment?: string;
  evaluation: {
    reference: string;
    split: {
      train_end: string;
      tuning_end: string;
      calibration_end: string;
      test_start: string;
      test_end: string;
    };
    horizons: Record<
      string,
      {
        model: { mae_c: number; rmse_c: number };
        persistence: { mae_c: number; rmse_c: number };
        warm_day_f1: number;
        warm_test_days: number;
        coverage_80: number;
        selected_method: string;
        test_n: number;
      }
    >;
  };
  comparison?: {
    date: string;
    sst_c: number;
    reference_c: number;
    anomaly_c: number;
    note: string;
  };
}
export const date = (value?: string, long = false) =>
  value
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: long ? "long" : "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
export const temp = (value?: number | null, digits = 1) =>
  value == null
    ? "—"
    : value.toLocaleString("tr-TR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export const riskLabels: Record<Risk, string> = {
  normal: "Normal",
  watch: "İzleme önceliği",
  high: "Yüksek inceleme önceliği",
  unknown: "Veri yok",
};
export async function readSnapshot(
  mode: Mode,
  eventId?: string,
): Promise<Snapshot | null> {
  if (mode === "replay") {
    if (eventId) {
      const catalog = await readReplayEvents();
      const selected = catalog.find((s) => s.origin_date === eventId);
      if (!selected) throw new Error("Seçilen geçmiş olay bulunamadı.");
      return selected;
    }
    const r = await fetch("/replay.json");
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Geçmiş veri okunamadı.");
    const data = await r.json();
    return enrichSnapshot(validateSnapshot(data, mode));
  }
  if (integrationError) throw new Error(integrationError);
  if (supabase) {
    const { data, error } = await supabase
      .from("snapshots")
      .select("payload")
      .eq("region_id", "akkuyu")
      .eq("mode", mode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.payload ? validateSnapshot(data.payload, mode) : null;
  }
  const r = await fetch("/live.json");
  if (
    !r.ok ||
    !(r.headers.get("content-type") || "").includes("application/json")
  )
    return null;
  const data = await r.json();
  return enrichSnapshot(validateSnapshot(data, mode));
}

export function validateSnapshot(data: Snapshot, mode: Mode): Snapshot | null {
  if (data.status !== "ready") return null;
  if (
    data.mode !== mode ||
    !data.origin_date ||
    !Number.isFinite(data.observation?.sst_c) ||
    !Number.isFinite(data.observation?.reference_c) ||
    !Number.isFinite(data.observation?.p90_c) ||
    data.forecasts?.length !== 3 ||
    new Set(data.forecasts.map((f) => f.horizon_days)).size !== 3 ||
    data.forecasts.some(
      (f) =>
        !Number.isFinite(f.sst_c) ||
        ![1, 2, 3].includes(f.horizon_days) ||
        !Number.isFinite(f.reference_c) ||
        !Number.isFinite(f.p90_c) ||
        !Number.isFinite(f.lower_c) ||
        !Number.isFinite(f.upper_c) ||
        f.lower_c > f.sst_c ||
        f.upper_c < f.sst_c ||
        f.origin_date !== data.origin_date ||
        Math.round(
          (Date.parse(f.target_date) - Date.parse(f.origin_date)) / 86400000,
        ) !== f.horizon_days,
    )
  )
    throw new Error(
      "Veri dosyasındaki gözlem ve tahmin tarihleri doğrulanamadı.",
    );
  return data;
}
export async function readReplayEvents(): Promise<Snapshot[]> {
  const r = await fetch("/replay-events.json");
  if (!r.ok) throw new Error("Geçmiş olay listesi yüklenemedi.");
  const data = await r.json();
  if (!Array.isArray(data.events))
    throw new Error("Geçmiş olay listesi geçersiz.");
  const extraResponse = await fetch("/reliability-replays.json");
  const extra = extraResponse.ok ? await extraResponse.json() : { events: [] };
  const snapshots = [...data.events, ...(extra.events ?? [])]
    .map((s: Snapshot) => validateSnapshot(s, "replay"))
    .filter((s: Snapshot | null): s is Snapshot => s !== null);
  return Promise.all(
    snapshots.map((s: Snapshot) => enrichSnapshot(s) as Promise<Snapshot>),
  );
}

type ReliabilityOverlay = Pick<
  Snapshot,
  "mode" | "origin_date" | "forecasts" | "early_warning" | "reports"
>;
export function mergeReliabilitySnapshot(
  base: Snapshot,
  overlay: ReliabilityOverlay,
): Snapshot {
  if (
    base.mode !== overlay.mode ||
    base.origin_date !== overlay.origin_date ||
    overlay.forecasts.length !== 3 ||
    overlay.forecasts.some(
      (f, i) =>
        f.sst_c !== base.forecasts[i].sst_c ||
        f.target_date !== base.forecasts[i].target_date ||
        f.horizon_days !== base.forecasts[i].horizon_days ||
        !f.warning ||
        !f.interval ||
        f.interval.calibration_end >= base.origin_date ||
        !(f.interval.test_coverage >= 0 && f.interval.test_coverage <= 1) ||
        !Number.isFinite(f.warning.threshold_c) ||
        !Number.isFinite(f.warning.signal_c),
    )
  )
    throw new Error("Güvenilirlik değerlendirmesi bu tahminle eşleşmiyor.");
  const merged = { ...base, ...overlay };
  validateSnapshot(merged, base.mode);
  return merged;
}
let reliabilityData:
  | Promise<{ dataset_id: string; snapshots: ReliabilityOverlay[] } | null>
  | undefined;
async function enrichSnapshot(base: Snapshot | null): Promise<Snapshot | null> {
  if (!base || base.early_warning) return base;
  reliabilityData ??= fetch("/reliability-snapshots.json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const data = await reliabilityData;
  if (!data || data.dataset_id !== base.source.dataset_id) return base;
  const overlay = data.snapshots.find(
    (s) => s.mode === base.mode && s.origin_date === base.origin_date,
  );
  return overlay ? mergeReliabilitySnapshot(base, overlay) : base;
}
