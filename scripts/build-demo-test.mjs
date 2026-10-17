import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-demo-test"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_APP_MODE: "demo",
      VITE_ENABLE_LIVE_INTEGRATIONS: "false",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
);
process.exit(result.status ?? 1);
