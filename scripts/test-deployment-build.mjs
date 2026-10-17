import { spawnSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

const fixture = {
  VITE_APP_MODE: "production",
  VITE_SUPABASE_URL: "https://fixture-production.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_deployment_fixture",
  VITE_API_URL: "https://fixture-production.onrender.com",
};
function javascript(path) {
  return readdirSync(path).flatMap((name) => {
    const item = join(path, name);
    return statSync(item).isDirectory()
      ? javascript(item)
      : name.endsWith(".js")
        ? [item]
        : [];
  });
}
const measurements = {};
for (const target of ["production", "preview"]) {
  const directory = `dist-deployment-test/${target}`;
  const result = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build", "--outDir", directory],
    {
      stdio: "inherit",
      env: { ...process.env, ...fixture, VERCEL_ENV: target },
    },
  );
  assert.equal(result.status, 0, `${target} build failed`);
  const scripts = javascript(directory);
  const content = scripts.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.ok(
    !content.includes("localhost:8000") && !content.includes("127.0.0.1:8000"),
    "Hosted code must not fall back to a local API",
  );
  for (const value of Object.values(fixture).filter(
    (value) => value.startsWith("https:") || value.startsWith("sb_"),
  )) {
    assert.equal(
      content.includes(value),
      target === "production",
      `${target} connection isolation failed`,
    );
  }
  const html = readFileSync(`${directory}/index.html`, "utf8");
  const entry = html.match(/src="([^\"]+\.js)"/)[1];
  const source = readFileSync(join(directory, entry.slice(1)));
  measurements[target] = {
    entry_bytes: source.length,
    entry_gzip_bytes: gzipSync(source).length,
    js_chunks: scripts.length,
  };
}
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/deployment-build-metrics.json",
  JSON.stringify(measurements, null, 2),
);
console.log("Hosted build isolation passed:", measurements);
