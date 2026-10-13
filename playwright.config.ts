import { defineConfig, devices } from "@playwright/test";

// End-to-end journeys against a production build and local Supabase. A dev
// server is avoided because its file watcher reloads pages mid-test.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 720 } } },
  ],
  // Pointed at a deployed URL, test it directly instead of starting a local server.
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100/api/v1/health/live",
    reuseExistingServer: true,
    timeout: 300_000,
    // Each test starts its own sandbox; raise the per-IP creation limit for the suite only.
    env: { SANDBOX_RATE_LIMIT: "200" },
  },
});
