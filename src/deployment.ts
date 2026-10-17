import { isPublicSupabaseKey } from "./auth";

type Environment = Record<string, string | undefined>;
const publicNames = new Set([
  "VITE_APP_MODE",
  "VITE_ENABLE_LIVE_INTEGRATIONS",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_API_URL",
]);

// Vercel's documented Vite metadata is build-only, never part of publicEnv.
// https://vercel.com/docs/environment-variables/framework-environment-variables
// Keep exact names: a VITE_VERCEL_* wildcard would also accept user secrets.
const vercelMetadataNames = new Set([
  "VITE_VERCEL_ENV",
  "VITE_VERCEL_TARGET_ENV",
  "VITE_VERCEL_URL",
  "VITE_VERCEL_BRANCH_URL",
  "VITE_VERCEL_PROJECT_PRODUCTION_URL",
  "VITE_VERCEL_HASH_SALT",
  "VITE_VERCEL_GIT_PROVIDER",
  "VITE_VERCEL_GIT_REPO_SLUG",
  "VITE_VERCEL_GIT_REPO_OWNER",
  "VITE_VERCEL_GIT_REPO_ID",
  "VITE_VERCEL_GIT_COMMIT_REF",
  "VITE_VERCEL_GIT_COMMIT_SHA",
  "VITE_VERCEL_GIT_COMMIT_MESSAGE",
  "VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
  "VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME",
  "VITE_VERCEL_GIT_PULL_REQUEST_ID",
]);

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
    ([name, value]) =>
      value && !publicNames.has(name) && !vercelMetadataNames.has(name),
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
