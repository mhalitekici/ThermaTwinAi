import { isPublicSupabaseKey } from "./auth";

type Environment = Record<string, string | undefined>;
const publicNames = new Set([
  "VITE_APP_MODE",
  "VITE_ENABLE_LIVE_INTEGRATIONS",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_API_URL",
]);

// Pass the actual process environment as hosting; never derive it from .env or VITE_*.
export function applicationEnvironment(env: Environment, hosting: Environment) {
  const target = hosting.VERCEL_ENV || "development";
  const hosted =
    hosting.VERCEL === "1" && ["preview", "production"].includes(target);
  if (target !== "development" && !hosted)
    throw new Error("Vercel hosting bağlamı doğrulanamadı; build durduruldu.");
  // Discard provider inputs before application validation, even if they contain secrets.
  // This is an exclusion, never a wildcard permission to expose these fields.
  return Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => !(hosted && name.startsWith("VITE_VERCEL_")),
    ),
  );
}

function httpsAddress(value: string | undefined, originOnly = false): boolean {
  try {
    const url = new URL(value || "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!originOnly || url.pathname === "/") &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

export function publicDeployment(env: Environment, target = "development") {
  if (!["development", "preview", "production"].includes(target))
    throw new Error("Deployment ortamı geçersiz; build durduruldu.");
  if (
    Object.values(env).some(
      (value) =>
        value &&
        /sb_secret_|\bre_[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}/.test(value),
    )
  )
    throw new Error("Public alanda sunucu sırrı saptandı; build durduruldu.");
  // Never expose arbitrary VITE_* fields, including secrets hidden under a generic name.
  const unknownName = Object.entries(env).find(
    ([name, value]) => value && !publicNames.has(name),
  )?.[0];
  if (unknownName) {
    // Diagnose the field, never its value; prevent log injection via field names.
    const label = /^VITE_[A-Z0-9_]{1,80}$/.test(unknownName)
      ? unknownName
      : "[geçersiz alan adı]";
    throw new Error(
      `Bilinmeyen veya gizli VITE_ alanı (${label}); build durduruldu.`,
    );
  }
  if (
    env.VITE_SUPABASE_ANON_KEY &&
    !isPublicSupabaseKey(env.VITE_SUPABASE_ANON_KEY)
  )
    throw new Error(
      "Supabase anahtarı public/publishable olmalı; build durduruldu.",
    );
  const appMode =
    env.VITE_APP_MODE ||
    (env.VITE_ENABLE_LIVE_INTEGRATIONS === "true" ? "production" : "demo");
  if (!["demo", "production"].includes(appMode))
    throw new Error("VITE_APP_MODE geçersiz; build durduruldu.");
  if (target === "preview")
    return {
      VITE_APP_MODE: "demo",
      VITE_ENABLE_LIVE_INTEGRATIONS: "false",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_API_URL: "",
      VITE_DEPLOYMENT_ENV: "preview",
    };
  if (
    target === "production" &&
    (appMode !== "production" ||
      !env.VITE_SUPABASE_ANON_KEY ||
      !httpsAddress(env.VITE_SUPABASE_URL, true) ||
      !httpsAddress(env.VITE_API_URL))
  )
    throw new Error(
      "Production için public Supabase ve HTTPS API adresi gerekli; build durduruldu.",
    );
  return {
    VITE_APP_MODE: appMode,
    VITE_ENABLE_LIVE_INTEGRATIONS: env.VITE_ENABLE_LIVE_INTEGRATIONS || "false",
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || "",
    VITE_API_URL: (env.VITE_API_URL || "").replace(/\/+$/, ""),
    VITE_DEPLOYMENT_ENV: target,
  };
}
