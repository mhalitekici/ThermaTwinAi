import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { isPublicSupabaseKey } from "./src/auth";

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
    ),
  };
  if (
    env.VITE_SUPABASE_ANON_KEY &&
    !isPublicSupabaseKey(env.VITE_SUPABASE_ANON_KEY)
  )
    throw new Error(
      "VITE_SUPABASE_ANON_KEY yalnız publishable/anon anahtarını kabul eder; build durduruldu.",
    );
  if (
    Object.entries(env).some(
      ([name, value]) =>
        value && /VITE_.*(SERVICE_ROLE|RESEND|SECRET|PASSWORD)/.test(name),
    )
  )
    throw new Error("Sunucu sırrı VITE_ alanına konamaz; build durduruldu.");
  return {
    plugins: [react(), tailwindcss()],
    build: { chunkSizeWarningLimit: 800 },
  };
});
