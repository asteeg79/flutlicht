// Übernommen aus Workgrid playwright.config.ts, angepasst: E-Mail/Passwort statt Dev-Login,
// lokaler Storage in .data-e2e, großzügige Rate-Limits (alle Requests kommen von localhost).
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export const testEnv = {
  AUTH_SECRET: "e2e-secret-0000000000000000000000000000",
  AUTH_TRUST_HOST: "true",
  APP_ENCRYPTION_SECRET: "e2e-enc-secret-00000000000000000000000",
  FM_LOCAL_DATA_DIR: ".data-e2e",
  ADMIN_EMAILS: "admin@e2e.test",
  RATE_LIMIT_PER_MIN: "1000000",
  AUTH_RATE_LIMIT: "1000000",
  PORT: String(PORT),
};

/** Geräte für e2e/devices.spec.ts (Projektname → Playwright-Profil). */
const DEVICES = [
  ["iphone-15", "iPhone 15"],
  ["iphone-se", "iPhone SE"],
  ["pixel-7", "Pixel 7"],
  ["galaxy-s8", "Galaxy S8"],
] as const;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Abläufe mit Zustand (Konten, Kader, Transfers) laufen einmal durch.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /devices\.spec\.ts/,
    },
    // Danach die Oberfläche auf emulierten Handys: iPhones mit WebKit (wie Safari),
    // Android mit Chromium (wie Chrome), je ein großes und ein schmales Gerät.
    ...DEVICES.map(([name, device]) => ({
      name,
      use: { ...devices[device] },
      testMatch: /devices\.spec\.ts/,
      dependencies: ["mobile"],
    })),
  ],
  webServer: {
    // In der CI gegen den Produktions-Build: schneller und näher am Betrieb als next dev,
    // dessen Kompilieren beim ersten Seitenaufruf die Zeitgrenzen reißen kann.
    command: process.env.CI
      ? `node ../scripts/stage-data.mjs && next build && next start -p ${PORT}`
      : `node ../scripts/stage-data.mjs && next dev -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: testEnv,
  },
});
