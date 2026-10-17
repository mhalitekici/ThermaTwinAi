import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  webServer: {
    command:
      "npm run preview -- --outDir dist-demo-test --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
  },
  projects: [
    ...[1920, 1366, 768, 390].map((width) => ({
      name: `${width}px`,
      use: {
        viewport: { width, height: width === 390 ? 844 : 1000 },
        browserName: "chromium" as const,
      },
    })),
  ],
});
