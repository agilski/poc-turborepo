import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || 3001;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  outputDir: "test-results/",
  reporter: "html",

  webServer: {
    command: "pnpm dev",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },

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
