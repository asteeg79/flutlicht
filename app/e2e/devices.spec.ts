import { expect, test, type Page } from "@playwright/test";

/**
 * Oberfläche auf emulierten Handys (Projekte iphone-15, iphone-se, pixel-7, galaxy-s8 in
 * playwright.config.ts). Läuft nach den Abläufen mit Zustand: der Admin hat dann einen Kader.
 * Screenshots landen in test-results/devices/<Gerät>/ zur Sichtprüfung.
 */

const PAGES = [
  ["team", "/team"],
  ["markt", "/markt"],
  ["spieltag", "/spieltag"],
  ["tabelle", "/tabelle"],
  ["historie", "/historie"],
  ["optionen", "/einstellungen"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("admin@e2e.test");
  await page.getByLabel("Passwort").fill("flutlicht-an");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
});

/** Texte, die einzeilig sein müssen, laufen nicht über und brechen nicht um. */
async function expectSingleLine(page: Page) {
  const bad = await page.evaluate(() => {
    const visible = (sel: string) =>
      [...document.querySelectorAll<HTMLElement>(sel)].filter(
        (e) => e.offsetParent !== null,
      );
    const textRects = (e: HTMLElement) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return { all: [...r.getClientRects()], box: r.getBoundingClientRect() };
    };
    // Umbruch = ein Textstück liegt ganz unter einem anderen (verschieden große Schrift in
    // einer Zeile überlappt sich vertikal); zu breit = Text breiter als sein Kasten.
    const wraps = (e: HTMLElement) => {
      const rs = textRects(e).all.filter((q) => q.width > 0);
      return rs.some((a) => rs.some((b) => b.top >= a.bottom - 1));
    };
    const tooWide = (e: HTMLElement) =>
      textRects(e).box.width > e.getBoundingClientRect().width + 1;
    return [
      ...visible('nav[aria-label="Hauptnavigation"] a').filter(tooWide),
      ...visible(
        "header.hero-bg .whitespace-nowrap, header.hero-bg .tabular-nums",
      ).filter((e) => wraps(e) || tooWide(e)),
    ].map((e) => (e.textContent ?? "").trim().slice(0, 30));
  });
  expect(bad, `umbrechend/überlaufend: ${bad.join(" | ")}`).toEqual([]);
}

/** Nichts ragt seitlich über den Bildschirm hinaus. */
async function expectNoHorizontalScroll(page: Page) {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(width);
}

test("Hauptseiten: kein seitliches Scrollen, Navigation sichtbar", async ({
  page,
}, info) => {
  for (const [name, path] of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("navigation", { name: "Hauptnavigation" }).first(),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectSingleLine(page);
    await page.screenshot({
      path: `test-results/devices/${info.project.name}/${name}.png`,
    });
  }
});

test("Team: Formationsleiste einzeilig, Auswahl lässt das Spielfeld sichtbar", async ({
  page,
}, info) => {
  const buttons = page
    .getByRole("group", { name: "Formation wählen" })
    .getByRole("button");
  await expect(buttons).toHaveCount(5);
  for (const b of await buttons.all()) {
    const fits = await b.evaluate(
      (el) =>
        el.scrollWidth <= el.clientWidth &&
        el.getBoundingClientRect().height <= 48,
    );
    expect(fits, `${await b.textContent()} passt nicht`).toBe(true);
  }

  await page.getByTestId("player-token").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const { height } = (await sheet.boundingBox())!;
  const viewport = page.viewportSize()!;
  // Kompaktes Sheet: höchstens ein Drittel des Bildschirms.
  expect(height).toBeLessThan(viewport.height / 3);
  await page.screenshot({
    path: `test-results/devices/${info.project.name}/team-auswahl.png`,
  });
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("Team: rote Badges nach ungültigem Tausch verschwinden wieder", async ({
  page,
}) => {
  // Torhüter der Startelf gegen einen Feldspieler auf der Bank: nicht erlaubt.
  await page
    .locator('[data-testid=player-token][aria-label*="Torhüter"]')
    .click();
  await page.getByTestId("bench-card").nth(1).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Torhüter" }),
  ).toBeVisible();
  const errors = page.locator('[data-state="error"]');
  await expect(errors).toHaveCount(2);
  await expect(errors).toHaveCount(0, { timeout: 3000 });
});
