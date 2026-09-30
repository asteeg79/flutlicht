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
  await expect(page.getByRole("heading", { name: "Dein Kader" })).toBeVisible();
  await page.getByLabel("Sortierung mobil").selectOption("price-asc");

  const list = page.getByRole("list", { name: "Spielerliste" });
  for (const [label, count] of COMPOSITION) {
    await page.getByRole("button", { name: label, exact: true }).click();
    for (let i = 0; i < count; i++) {
      await list
        .getByRole("button", { name: "Holen", exact: true })
        .first()
        .click();
    }
    // Position voll: kein weiterer Spieler dieser Position wählbar.
    await expect(
      list.getByRole("button", { name: "Holen", exact: true }),
    ).toHaveCount(0);
  }

  await expect(page.getByText("Kader komplett!")).toBeVisible();
  await page.getByRole("button", { name: "Kader speichern" }).click();
  const celebration = page.getByTestId("celebration");
  await expect(celebration).toContainText("Kader steht!");
  await celebration.click();

  // Nach dem Speichern: Tausch-Modus mit Guthaben statt Budget-Anzeige.
  await expect(
    page.getByRole("heading", { name: "Transfermarkt" }),
  ).toBeVisible();
  await expect(page.getByText("Guthaben")).toBeVisible();
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
  await expect(page.getByTestId("save-pill")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "3-5-2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Automatisch aufstellen nach Punkten: ergibt eine gültige Startelf.
  await page.getByRole("radio", { name: "Punkte" }).click();
  await page.getByRole("button", { name: "Auto-Aufstellung" }).click();
  await expect(page.getByTestId("save-pill")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: /^Startelf, / }).getByRole("button"),
  ).toHaveCount(11);

  // Auswählen: das Sheet zeigt den Spieler, gültige Partner sind gelb, Esc schließt.
  await page.getByTestId("player-token").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId("player-token").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // Transfer-Historie: der Erstkader steht mit Kaufpreis „Im Kader“.
  await page.getByRole("link", { name: "Historie", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Historie" })).toBeVisible();
  await expect(page.getByText("Noch keine Verkäufe.")).toBeVisible();
  await expect(page.getByText(/^Erstkader für /)).toHaveCount(15);
});

test("Holen: Abgabe wählen, Deal bestätigen, Feier; Abgeben zuerst mit Banner", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("admin@e2e.test");
  await page.getByLabel("Passwort").fill("flutlicht-an");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.getByRole("link", { name: "Markt", exact: true }).click();

  const list = page.getByRole("list", { name: "Spielerliste" });
  const row = list.getByTestId("market-row").filter({
    has: page.getByRole("button", { name: "Holen", exact: true }),
  });
  const name = await row.first().getByRole("link").textContent();
  await row.first().getByRole("button", { name: "Holen", exact: true }).click();

  const pick = page.getByRole("dialog");
  await expect(pick).toContainText("Wen gibst du dafür ab?");
  await pick.getByRole("button", { name: "Abgeben" }).first().click();

  const confirm = page.getByRole("dialog", { name: "Deal bestätigen" });
  await expect(confirm).toContainText("Guthaben danach");
  await confirm.getByRole("button", { name: "Deal!" }).click();

  const celebration = page.getByTestId("celebration");
  await expect(celebration).toContainText(name!);
  await celebration.click();
  await expect(celebration).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Deal!" }),
  ).toBeVisible();
  await expect(
    list
      .getByTestId("market-row")
      .filter({ hasText: name! })
      .getByText("Im Kader"),
  ).toBeVisible();

  // Abgeben zuerst: Mein Kader → Abgeben → rotes Banner, Liste nur gleiche Position.
  await page.getByRole("tab", { name: "Mein Kader" }).click();
  await page.getByRole("button", { name: "Abgeben" }).first().click();
  await expect(page.getByText("Abgabe · Ersatz gesucht")).toBeVisible();
  await expect(page.getByRole("group", { name: "Position" })).toHaveCount(0);
  await page.getByRole("button", { name: "Stopp" }).click();
  await expect(page.getByText("Abgabe · Ersatz gesucht")).toHaveCount(0);
});
