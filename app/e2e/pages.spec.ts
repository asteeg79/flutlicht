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
  await page.getByRole("link", { name: "Bundesliga", exact: true }).click();
  await expect(page).toHaveURL(/\/tabelle\/bundesliga$/);
  await expect(
    page.getByRole("table", { name: "Bundesliga" }).getByRole("row"),
  ).toHaveCount(19);
  await page.screenshot({
    path: "test-results/bundesliga.png",
    fullPage: true,
  });

  await page.getByRole("link", { name: "Markt", exact: true }).click();
  const playerLink = page
    .getByRole("list", { name: "Spielerliste" })
    .getByRole("link")
    .first();
  const name = await playerLink.textContent();
  // Liste lädt seitenweise: 100 Zeilen, „Mehr anzeigen“ holt die nächsten, Filtern setzt zurück.
  const rows = page
    .getByRole("list", { name: "Spielerliste" })
    .getByTestId("market-row");
  await expect(rows).toHaveCount(100);
  await page.getByRole("button", { name: "Mehr anzeigen" }).click();
  await expect(rows).toHaveCount(200);
  await page.getByRole("button", { name: "MF", exact: true }).click();
  await page.getByRole("button", { name: "ALLE", exact: true }).click();
  await expect(rows).toHaveCount(100);
  // Textsuche: Teil des Namens in Kleinbuchstaben findet den Spieler.
  await page
    .getByLabel("Spieler suchen")
    .fill(name!.split(" ").at(-1)!.toLowerCase());
  await expect(playerLink).toHaveText(name!);
  await page.getByLabel("Spieler suchen").fill("xyzqq");
  await expect(page.getByText("0 Spieler")).toBeVisible();
  await page.getByLabel("Spieler suchen").fill("");
  await playerLink.click();
  await expect(page.getByRole("heading", { name: name! })).toBeVisible();
  await expect(page.getByText("Preisverlauf")).toBeVisible();
});

test("Historie zeigt Verlauf, Verkäufe und Kader", async ({ page }) => {
  await page.getByRole("link", { name: "Historie", exact: true }).click();
  await expect(page).toHaveURL(/\/historie$/);
  for (const name of ["Verlauf", "Verkauft", "Im Kader"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/historie.png", fullPage: true });
});

test("Anleitung aus der App: „?“ im Markt und Eintrag in den Optionen", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Markt", exact: true }).click();
  await page
    .getByRole("link", { name: "So funktionieren Markt und Transfers" })
    .click();
  const guide = page.getByRole("dialog", { name: "Markt & Transfers" });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Anleitung schließen" }).click();
  await expect(guide).toHaveCount(0);
  await expect(page).toHaveURL(/\/markt$/);

  await page.getByRole("link", { name: "Optionen", exact: true }).click();
  await page.getByRole("link", { name: "Anleitung und Regeln" }).click();
  await expect(page.getByRole("dialog", { name: "Die Idee" })).toBeVisible();
});

test("Einstellungen zeigen die Push-Benachrichtigungen", async ({ page }) => {
  await page.getByRole("link", { name: "Optionen", exact: true }).click();
  const push = page.getByRole("region", { name: "Benachrichtigungen" });
  await expect(
    push.getByRole("heading", { name: "Push auf diesem Gerät" }),
  ).toBeVisible();
  await expect(
    push.getByRole("switch", { name: "Push-Benachrichtigungen" }),
  ).toBeVisible();
});

test("Admin erzeugt einen Einladungscode, ein neuer Manager registriert sich damit", async ({
  page,
  context,
}) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  const invites = page.getByRole("region", { name: "Einladungen" });
  await invites.getByRole("button", { name: "Neuen Code erzeugen" }).click();
  const code = (await invites.locator("code").first().textContent())!;
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

  // Zuordnung und fehlende Werte starten zugeklappt und lassen sich öffnen.
  const values = page.getByRole("region", { name: "Fehlende Werte" });
  await expect(values.getByText("ohne Marktwert")).toBeHidden();
  await values.locator("summary").click();
  await expect(values.getByText("ohne Marktwert")).toBeVisible();
  await page
    .getByRole("region", { name: "Zuordnung" })
    .locator("summary")
    .click();
  await page.screenshot({ path: "test-results/admin.png", fullPage: true });

  await context.clearCookies();
  await page.goto("/registrieren");
  await page.getByLabel("Einladungscode").fill(code);
  await page.getByLabel("E-Mail").fill("neu@e2e.test");
  await page.getByLabel("Passwort").fill("flutlicht-neu");
  await page.getByLabel("Anzeigename").fill("Neu");
  await page.getByLabel("Teamname").fill("Neu FC");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page).toHaveURL(/\/team\?anleitung=idee$/);
  await page.getByRole("button", { name: "Anleitung schließen" }).click();

  // Spieler ohne Admin-Rolle sehen /admin nicht.
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toHaveCount(0);
});

test("Darstellung: Hell und Dunkel schalten sofort um und bleiben nach dem Neuladen", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Optionen", exact: true }).click();
  const html = page.locator("html");
  await page.getByRole("radio", { name: "Hell" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("radio", { name: "Hell" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Dunkel" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "System" }).click();
  await expect(page.getByRole("radio", { name: "System" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
