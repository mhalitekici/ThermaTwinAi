import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
const serverOnly = {
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_SERVER_ONLY_DEPLOYMENT_FIXTURE",
  RESEND_API_KEY: "re_SERVER_ONLY_DEPLOYMENT_FIXTURE_1234567890",
};
// A fresh field name on every run proves isolation does not depend on enumeration.
const futureMetadataName = `VITE_VERCEL_FUTURE_${randomUUID().replaceAll("-", "").toUpperCase()}`;
const vercelMetadata = {
  VITE_VERCEL_ENV: "preview",
  VITE_VERCEL_PROJECT_ID: "prj_SYSTEM_PROJECT_FIXTURE_ONLY",
  VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG: JSON.stringify({
    fixture: "SYSTEM_OBSERVABILITY_FIXTURE_ONLY",
    token: serverOnly.RESEND_API_KEY,
  }),
  [futureMetadataName]: "sb_secret_FUTURE_METADATA_FIXTURE_ONLY",
};
const forbiddenValues = [
  ...Object.values(serverOnly),
  ...Object.keys(vercelMetadata),
  ...Object.values(vercelMetadata).filter((value) => value !== "preview"),
  "SYSTEM_OBSERVABILITY_FIXTURE_ONLY",
];
function environment(target, patch = {}) {
  return {
    ...process.env,
    ...fixture,
    ...vercelMetadata,
    ...serverOnly,
    VERCEL: "1",
    VERCEL_ENV: target,
    VITE_VERCEL_ENV: target,
    ...patch,
  };
}

// Fail before bundling and keep diagnostics free of test credential values.
for (const [name, target, patch, message] of [
  [
    "current demo-only Production settings",
    "production",
    {
      VITE_APP_MODE: "demo",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
    /Production için public Supabase ve HTTPS API adresi gerekli/,
  ],
  [
    "Production without Supabase",
    "production",
    { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    /Production için public Supabase ve HTTPS API adresi gerekli/,
  ],
  [
    "unknown user field",
    "preview",
    { VITE_UNRELATED: "PRIVATE_UNKNOWN_FIXTURE_ONLY" },
    /VITE_UNRELATED/,
  ],
  [
    "hosted target without the Vercel marker",
    "preview",
    { VERCEL: "" },
    /Vercel hosting bağlamı doğrulanamadı/,
  ],
  [
    "provider metadata without a hosted target",
    "development",
    {
      VERCEL: "1",
      VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG:
        "SYSTEM_OBSERVABILITY_FIXTURE_ONLY",
      [futureMetadataName]: "FUTURE_METADATA_FIXTURE_ONLY",
    },
    /VITE_VERCEL_ENV/,
  ],
  [
    "invalid Vercel marker",
    "preview",
    { VERCEL: "0" },
    /Vercel hosting bağlamı doğrulanamadı/,
  ],
  [
    "provider metadata attempting to select preview",
    "production",
    {
      VITE_VERCEL_ENV: "preview",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
    /Production için public Supabase ve HTTPS API adresi gerekli/,
  ],
  [
    "server key in a public field",
    "preview",
    { VITE_SUPABASE_ANON_KEY: serverOnly.SUPABASE_SERVICE_ROLE_KEY },
    /Public alanda sunucu sırrı/,
  ],
  [
    "Resend key hidden in an allowed application field",
    "preview",
    { VITE_API_URL: `https://api.example.test/${serverOnly.RESEND_API_KEY}` },
    /Public alanda sunucu sırrı/,
  ],
]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    { env: environment(target, patch), encoding: "utf8" },
  );
  assert.notEqual(result.status, 0, `${name} must stop the build`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, message);
  for (const value of [
    ...Object.values(patch),
    ...Object.values(serverOnly),
    ...Object.values(vercelMetadata),
  ]) {
    if (value && !["0", "1", "demo", "preview", "production"].includes(value))
      assert.ok(
        !output.includes(value),
        "Build diagnostics must not log values",
      );
  }
}
function outputFiles(path) {
  return readdirSync(path).flatMap((name) => {
    const item = join(path, name);
    return statSync(item).isDirectory()
      ? outputFiles(item)
      : /\.(js|html|css|map)$/.test(name)
        ? [item]
        : [];
  });
}
// Inspect the real resolved Vite configuration before bundling. This also catches
// metadata exposure when no application component happens to reference the field.
const inspectedBuild = `
  import { build } from "vite";
  import assert from "node:assert/strict";
  const allowedDefinitions = ${JSON.stringify(
    [
      "VITE_APP_MODE",
      "VITE_ENABLE_LIVE_INTEGRATIONS",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_API_URL",
      "VITE_DEPLOYMENT_ENV",
    ].map((name) => `import.meta.env.${name}`),
  )};
  const forbiddenValues = ${JSON.stringify(forbiddenValues)};
  await build({
    build: { outDir: process.argv[1] },
    plugins: [{
      name: "verify-public-environment-boundary",
      configResolved(config) {
        assert.deepEqual(config.envPrefix, [], "Automatic env exposure must stay disabled");
        assert.deepEqual(Object.keys(config.define).sort(), allowedDefinitions.sort());
        const exposed = JSON.stringify({ env: config.env, define: config.define });
        for (const value of forbiddenValues)
          assert.ok(!exposed.includes(value), "Metadata or server secret reached Vite config output");
      },
    }],
  });
`;
const measurements = {};
for (const [name, target, patch] of [
  ["production", "production", {}],
  ["preview", "preview", {}],
  [
    "preview-demo",
    "preview",
    {
      VITE_APP_MODE: "demo",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  ],
]) {
  const directory = `dist-deployment-test/${name}`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", inspectedBuild, directory],
    {
      stdio: "inherit",
      env: environment(target, patch),
    },
  );
  assert.equal(result.status, 0, `${target} build failed`);
  const files = outputFiles(directory);
  const scripts = files.filter((path) => path.endsWith(".js"));
  const content = files.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const value of forbiddenValues) {
    assert.ok(!content.includes(value), "Build-only metadata or secret leaked");
  }
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
  measurements[name] = {
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
