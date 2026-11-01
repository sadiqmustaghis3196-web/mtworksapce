import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "**/preview.spec.js",
    "**/modules.spec.js",
    "**/professional.spec.js",
    "**/dailyDashboard.spec.js",
    "**/documents.spec.js",
    "**/notifications.spec.js",
  ],
  use: {
    baseURL: "http://127.0.0.1:8002",
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 8002 --strictPort",
    url: "http://127.0.0.1:8002/login",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  reporter: "list",
  outputDir: "/tmp/mt-preview-test-results",
});
