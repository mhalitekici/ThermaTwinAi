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
// Simulate the exact Vite framework fields injected by Vercel, not just VERCEL_ENV.
const vercelMetadata = {
  VITE_VERCEL_ENV: "preview",
  VITE_VERCEL_TARGET_ENV: "preview",
  VITE_VERCEL_URL: "system-deployment-fixture.vercel.app",
  VITE_VERCEL_BRANCH_URL: "system-branch-fixture.vercel.app",
  VITE_VERCEL_PROJECT_PRODUCTION_URL: "system-production-fixture.vercel.app",
  VITE_VERCEL_HASH_SALT: "SYSTEM_SALT_FIXTURE_ONLY",
  VITE_VERCEL_GIT_PROVIDER: "github",
  VITE_VERCEL_GIT_REPO_SLUG: "SYSTEM_REPO_FIXTURE_ONLY",
  VITE_VERCEL_GIT_REPO_OWNER: "SYSTEM_OWNER_FIXTURE_ONLY",
  VITE_VERCEL_GIT_REPO_ID: "9876543210123456789",
  VITE_VERCEL_GIT_COMMIT_REF: "SYSTEM_BRANCH_FIXTURE_ONLY",
  VITE_VERCEL_GIT_COMMIT_SHA: "abcdef0123456789abcdef0123456789abcdef01",
  VITE_VERCEL_GIT_COMMIT_MESSAGE: "SYSTEM_COMMIT_FIXTURE_ONLY",
  VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN: "SYSTEM_LOGIN_FIXTURE_ONLY",
  VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME: "SYSTEM_AUTHOR_FIXTURE_ONLY",
  VITE_VERCEL_GIT_PULL_REQUEST_ID: "9876543210123456788",
  VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG: JSON.stringify({
    fixture: "SYSTEM_OBSERVABILITY_FIXTURE_ONLY",
  }),
};
const serverOnly = {
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_SERVER_ONLY_DEPLOYMENT_FIXTURE",
  RESEND_API_KEY: "re_SERVER_ONLY_DEPLOYMENT_FIXTURE_1234567890",
};
function environment(target, patch = {}) {
  return {
    ...process.env,
    ...fixture,
    ...vercelMetadata,
    ...serverOnly,
    VERCEL_ENV: target,
    VITE_VERCEL_ENV: target,
    VITE_VERCEL_TARGET_ENV: target,
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
    "unknown Vercel-prefixed field",
    "preview",
    { VITE_VERCEL_SECRET: "PRIVATE_LOOKALIKE_FIXTURE_ONLY" },
    /VITE_VERCEL_SECRET/,
  ],
  [
    "server key in a public field",
    "preview",
    { VITE_SUPABASE_ANON_KEY: serverOnly.SUPABASE_SERVICE_ROLE_KEY },
    /Public alanda sunucu sırrı/,
  ],
  [
    "Resend key hidden in metadata",
    "preview",
    { VITE_VERCEL_GIT_COMMIT_MESSAGE: serverOnly.RESEND_API_KEY },
    /Public alanda sunucu sırrı/,
  ],
  ...[serverOnly.SUPABASE_SERVICE_ROLE_KEY, serverOnly.RESEND_API_KEY].map(
    (token) => [
      "server key hidden in observability metadata",
      "preview",
      {
        VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG: JSON.stringify({ token }),
      },
      /Public alanda sunucu sırrı/,
    ],
  ),
]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "build"],
    { env: environment(target, patch), encoding: "utf8" },
  );
  assert.notEqual(result.status, 0, `${name} must stop the build`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, message);
  for (const value of [...Object.values(patch), ...Object.values(serverOnly)]) {
    if (value && !["demo", "production"].includes(value))
      assert.ok(
        !output.includes(value),
        "Build diagnostics must not log values",
      );
  }
}
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
    ["node_modules/vite/bin/vite.js", "build", "--outDir", directory],
    {
      stdio: "inherit",
      env: environment(target, patch),
    },
  );
  assert.equal(result.status, 0, `${target} build failed`);
  const scripts = javascript(directory);
  const content = scripts.map((path) => readFileSync(path, "utf8")).join("\n");
  for (const value of [
    ...Object.values(serverOnly),
    "SYSTEM_OBSERVABILITY_FIXTURE_ONLY",
    ...Object.values(vercelMetadata).filter(
      (value) => !["preview", "github"].includes(value),
    ),
  ]) {
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
