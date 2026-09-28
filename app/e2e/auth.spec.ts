import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, request, test } from "@playwright/test";
import { testEnv } from "../playwright.config";

/**
 * Abnahme M5: mit Einladungscode registrieren → einloggen → ausloggen → mit
 * Reset-Code neues Passwort setzen. Ungültige Codes werden abgewiesen, /api/*
 * ohne Session liefert 401 JSON.
 */

const appDir = join(__dirname, "..");
function seed(...args: string[]) {
  execFileSync("pnpm", ["exec", "tsx", "e2e/seed.ts", ...args], {
    cwd: appDir,
    env: { ...process.env, ...testEnv },
    stdio: "inherit",
  });
}

const EMAIL = "tom@e2e.test";
const PASSWORD = "flutlicht-an";
const NEW_PASSWORD = "flutlicht-aus";

test.describe.configure({ mode: "serial" });

test("Registrieren mit Einladungscode, ungültiger Code wird abgewiesen", async ({
  page,
}) => {
  seed("invite", "E2E2TEST");
  await page.goto("/registrieren");
  await page.getByLabel("Einladungscode").fill("FALSCH22");
  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByLabel("Anzeigename").fill("Tom");
  await page.getByLabel("Teamname").fill("Flutlicht FC");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Der Einladungscode ist ungültig oder schon benutzt.",
  );

  await page.getByLabel("Einladungscode").fill("e2e2test");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(
    page.getByRole("heading", { name: "Flutlicht FC" }),
  ).toBeVisible();
});

test("Abmelden und wieder anmelden", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.getByRole("link", { name: "Optionen" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/team");
  await expect(page).toHaveURL(/\/login/);
});

test("Passwort mit Reset-Code ändern, falscher Code wird abgewiesen", async ({
  page,
}) => {
  seed("reset", EMAIL, "RSET2345");
  await page.goto("/passwort-reset");
  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByLabel("Reset-Code").fill("FALSCH22");
  await page.getByLabel("Neues Passwort").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "E-Mail oder Reset-Code passen nicht.",
  );

  await page.getByLabel("Reset-Code").fill("RSET2345");
  await page.getByRole("button", { name: "Passwort ändern" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("E-Mail").fill(EMAIL);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "E-Mail oder Passwort stimmen nicht.",
  );

  await page.getByLabel("Passwort").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
});

test("/api/* ohne Session liefert 401 JSON", async ({ baseURL }) => {
  const api = await request.newContext({ baseURL });
  for (const path of ["/api/me", "/api/irgendwas"]) {
    const res = await api.get(path);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  }
  expect((await api.get("/api/health")).status()).toBe(200);
  await api.dispose();
});
