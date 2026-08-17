import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against a real production build, because that is what the
// owner plays at judging time. `npm test` builds, serves, and drives it.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173/",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:4173/",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
