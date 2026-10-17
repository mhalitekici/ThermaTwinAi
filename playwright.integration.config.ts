import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e-integration",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5176", trace: "retain-on-failure" },
  webServer: [
    {
      command: `${process.platform === "win32" ? ".venv\\Scripts\\python.exe" : ".venv/bin/python"} -X utf8 tests/integration_server.py`,
      url: "http://127.0.0.1:5177/__test__/ready",
      reuseExistingServer: false,
    },
    {
      command:
        "npm run preview -- --outDir dist-integration-test --port 5176 --strictPort",
      url: "http://127.0.0.1:5176",
      reuseExistingServer: false,
    },
  ],
  projects: [1366, 390].map((width) => ({
    name: `connected-${width}px`,
    use: { viewport: { width, height: 900 }, browserName: "chromium" },
  })),
});
