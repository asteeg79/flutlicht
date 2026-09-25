import { expect, test } from "@playwright/test";

/**
 * M8: Spieltag, Tabelle und Spielerprofil sind mit den echten Daten erreichbar.
 * Läuft nach market.spec.ts (Admin mit Kader existiert). Die Rechenlogik prüft der
 * Szenario-Test in core/test/standings.test.ts.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("admin@e2e.test");
  await page.getByLabel("Passwort").fill("flutlicht-an");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
});

test("Spieltag, Tabelle und Spielerprofil", async ({ page }) => {
  await page.getByRole("link", { name: "Spieltag", exact: true }).click();
  await expect(page).toHaveURL(/\/spieltag\/\d+$/);
  await expect(
    page.getByRole("heading", { name: /\d+\. Spieltag/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Vorheriger Spieltag" }).click();
  await expect(
    page.getByRole("heading", { name: /\d+\. Spieltag/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Tabelle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tabelle" })).toBeVisible();

  await page.getByRole("link", { name: "Markt", exact: true }).click();
  const playerLink = page
    .getByRole("list", { name: "Spielerliste" })
    .getByRole("link")
    .first();
  const name = await playerLink.textContent();
  await playerLink.click();
  await expect(page.getByRole("heading", { name: name! })).toBeVisible();
  await expect(page.getByText("Preisverlauf")).toBeVisible();
});
