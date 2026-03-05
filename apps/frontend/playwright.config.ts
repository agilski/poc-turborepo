import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const PORT = process.env.PORT || 3001;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results/",
  reporter: "html",
  globalTeardown: "./e2e/global-teardown.ts",

  webServer: [
    {
      command: "pnpm dev --filter backend",
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      cwd: "../..",
    },
    {
      command: "pnpm dev",
      url: baseURL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
