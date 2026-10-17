import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { publicDeployment } from "./src/deployment";

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
    ),
  };
  const publicEnv = publicDeployment(
    env,
    process.env.VERCEL_ENV || "development",
  );
  return {
    plugins: [react(), tailwindcss()],
    envPrefix: [],
    define: Object.fromEntries(
      Object.entries(publicEnv).map(([name, value]) => [
        `import.meta.env.${name}`,
        JSON.stringify(value),
      ]),
    ),
    build: { chunkSizeWarningLimit: 800 },
  };
});
