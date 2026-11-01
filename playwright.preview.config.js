import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/preview.spec.js",
  use: {
    baseURL: "http://127.0.0.1:8002",
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  reporter: "list",
  outputDir: "/tmp/mt-preview-test-results",
});
