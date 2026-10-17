import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
for (const patch of [
  { VITE_SUPABASE_ANON_KEY: "sb_secret_TEST_ONLY" },
  { VITE_RESEND_API_KEY: "TEST_ONLY_SERVER_SECRET" },
]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    { env: { ...process.env, ...patch }, encoding: "utf8" },
  );
  assert.notEqual(
    result.status,
    0,
    "Server secret must stop the build before bundling",
  );
  assert.match(result.stderr, /build durduruldu/);
}
console.log(
  "Frontend secret guards passed; test-only fixture values never bundled.",
);
