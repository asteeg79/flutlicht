import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Test-Env: Dev-Login + lokaler Storage-Fallback (kein Blob/Google nötig).
const testEnv = {
  AUTH_SECRET: "e2e-secret-0000000000000000000000000000",
  APP_ENCRYPTION_SECRET: "e2e-enc-secret-00000000000000000000000",
  NEXT_PUBLIC_RP_ID: "localhost",
  ENABLE_DEV_LOGIN: "true",
  NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true",
  NEXTAUTH_URL: BASE_URL,
  PORT: String(PORT),
  // Rate-Limit im Test deaktivieren (alle Requests kommen von localhost).
  RATE_LIMIT_PER_MIN: "1000000",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: testEnv,
  },
});
