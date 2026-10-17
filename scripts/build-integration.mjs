import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--outDir",
    "dist-integration-test",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VERCEL_ENV: "",
      VITE_APP_MODE: "production",
      VITE_SUPABASE_URL: "http://127.0.0.1:5177",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_test_fixture",
      VITE_API_URL: "http://127.0.0.1:5177/api",
    },
  },
);
process.exit(result.status ?? 1);
