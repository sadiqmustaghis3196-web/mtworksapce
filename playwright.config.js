import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/workspace.spec.js",
  use: {
    baseURL: "http://127.0.0.1:8001",
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  reporter: "list",
  outputDir: "/tmp/mt-playwright-results",
});
