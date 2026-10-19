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
    // Sila sign-in runs against the local Supabase stack (`npx supabase start`); anon key comes from the environment or .env.local.
    env: {
      SANDBOX_RATE_LIMIT: "200",
      APP_BASE_URL: "http://localhost:3100",
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321",
      ...(process.env.E2E_SUPABASE_ANON_KEY ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY } : {}),
    },
  },
});
