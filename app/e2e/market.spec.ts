import { expect, test } from "@playwright/test";

/**
 * Abnahme M6 (E2E): Erstkader bauen. Mit den echten Daten aus data/:
 * je Position die günstigsten zulässigen Spieler wählen, speichern,
 * danach steht der Kader auf der Team-Seite.
 */

const COMPOSITION = [
  ["TW", 2],
  ["ABW", 5],
  ["MF", 5],
  ["ST", 3],
] as const;

test("Erstkader zusammenstellen und speichern", async ({ page }) => {
  // Admins (ADMIN_EMAILS) registrieren ohne Einladungscode.
  await page.goto("/registrieren");
  await page.getByLabel("E-Mail").fill("admin@e2e.test");
  await page.getByLabel("Passwort").fill("flutlicht-an");
  await page.getByLabel("Anzeigename").fill("Alex");
  await page.getByLabel("Teamname").fill("Rasenschach 04");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.getByRole("link", { name: "Markt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Markt" })).toBeVisible();
  await page.getByLabel("Sortierung").selectOption("price-asc");

  const list = page.getByRole("list", { name: "Spielerliste" });
  for (const [label, count] of COMPOSITION) {
    await page.getByRole("button", { name: label, exact: true }).click();
    for (let i = 0; i < count; i++) {
      await list
        .locator("button:enabled", { hasText: "Hinzufügen" })
        .first()
        .click();
    }
    // Position voll: kein weiterer Spieler dieser Position wählbar.
    await expect(
      list.locator("button:enabled", { hasText: "Hinzufügen" }),
    ).toHaveCount(0);
  }

  await expect(page.getByText("Kader vollständig")).toBeVisible();
  await page.getByRole("button", { name: "Kader speichern" }).click();
  await expect(page.getByText("Kader gespeichert.")).toBeVisible();

  // Nach dem Speichern: Tausch-Modus mit Guthaben statt Budget-Anzeige.
  await expect(page.getByText("Kaderwert")).toBeVisible();
  // Abnahme M7: Die Team-Seite zeigt die Startaufstellung (unabhängig vom Sperrstand der echten Daten).
  await page.getByRole("link", { name: "Team", exact: true }).click();
  const pitch = page.getByRole("region", { name: "Startelf, 4-4-2" });
  await expect(pitch.getByRole("button")).toHaveCount(11);
  await expect(pitch.getByRole("button", { name: /Kapitän/ })).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Bank" }).getByRole("button"),
  ).toHaveCount(4);

  // Formationswechsel per Schnellwahl, gespeichert auf dem Server.
  await page.getByRole("button", { name: "3-5-2", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Startelf, 3-5-2" }),
  ).toBeVisible();
  await expect(page.getByText("speichert")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "3-5-2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Automatisch aufstellen nach Punkten: ergibt eine gültige Startelf.
  await page.getByRole("radio", { name: "Punkte" }).click();
  await page.getByRole("button", { name: "Automatisch aufstellen" }).click();
  await expect(page.getByText("speichert")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /^Startelf, / }).getByRole("button"),
  ).toHaveCount(11);
});
