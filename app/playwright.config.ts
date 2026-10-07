import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for both deployables: the static landing page (served from the
 * repo root) and the Next app. The app runs against a dummy Supabase URL, so
 * these only cover pages that render without a session or database.
 */
const LANDING = "http://localhost:4000";
const APP = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "on-first-retry" },
  projects: [
    {
      name: "landing",
      testMatch: /landing\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: LANDING },
    },
    {
      name: "app",
      testMatch: /app\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: APP },
    },
  ],
  webServer: [
    {
      command: "node e2e/static-server.mjs",
      url: LANDING,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run start",
      url: `${APP}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "e2e-dummy-key",
      },
    },
  ],
});
