import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "health",
      testMatch: /e2e\/health\.spec\.ts$/,
    },
    {
      name: "chromium-app",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /e2e\/(?!health).*\.spec\.ts$/,
    },
  ],
});
