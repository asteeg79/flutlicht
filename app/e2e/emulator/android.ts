// Durchlauf im echten Chrome des Android-Emulators (docs/mobil-testen.md):
// anmelden, Hauptseiten und Team-Auswahl ansehen, Screenshots des ganzen Geräts
// (inkl. Browserleiste) nach test-results/emulator/android/.
// Voraussetzung: scripts/mobile/android.sh start und pnpm emulator:server.
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { testEnv } from "../../playwright.config";

const ADB = `${process.env.ANDROID_HOME ?? "/opt/homebrew/share/android-commandlinetools"}/platform-tools/adb`;
const BASE = `http://localhost:${testEnv.PORT}`;
const OUT = "test-results/emulator/android";
const adb = (...args: string[]) => execFileSync(ADB, args);

/** Chrome-eigene Hinweise (Passwort speichern, Übersetzen) über die Bedienungshilfen wegwischen. */
function dismissChromeHints() {
  for (let i = 0; i < 4; i++) {
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
    const xml = adb("exec-out", "cat", "/sdcard/ui.xml").toString();
    const hint = xml.match(
      /text="(Save password\?|Passwort speichern\?|Translate page\?|Seite übersetzen\?)"[^>]*bounds="\[\d+,(\d+)\]/,
    );
    if (hint) {
      adb(
        "shell",
        "input",
        "swipe",
        "540",
        String(Number(hint[2]) + 40),
        "540",
        "0",
        "150",
      );
      adb("shell", "sleep", "0.6");
      continue;
    }
    const button = xml.match(
      /text="(No thanks|Nein danke|Never|Nie|Not now|Got it)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
    );
    if (!button) return;
    const x = (Number(button[2]) + Number(button[4])) >> 1;
    const y = (Number(button[3]) + Number(button[5])) >> 1;
    adb("shell", "input", "tap", String(x), String(y));
  }
}

function shot(name: string) {
  writeFileSync(`${OUT}/${name}.png`, adb("exec-out", "screencap", "-p"));
  console.log(`  ${OUT}/${name}.png`);
}

async function visit(page: Page, name: string, path: string) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  if (scroll > width)
    console.warn(`  ⚠ ${path}: seitliches Scrollen (${scroll} > ${width})`);
  dismissChromeHints();
  shot(name);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0]!;
  // Nur der sichtbare Tab landet im Screenshot; ältere Tabs schließen.
  let page = context.pages().at(-1) ?? (await context.newPage());
  for (const p of context.pages())
    if ((await p.evaluate(() => document.visibilityState)) === "visible")
      page = p;
  for (const p of context.pages()) if (p !== page) await p.close();

  await page.goto(`${BASE}/login`);
  if (page.url().includes("/login")) {
    await page.getByLabel("E-Mail").fill("admin@e2e.test");
    await page.getByLabel("Passwort").fill("flutlicht-an");
    // Die Bildschirmtastatur verschiebt die Seite: absenden wie ein Nutzer.
    await page.getByLabel("Passwort").press("Enter");
  }
  await page.waitForURL(/\/team/, { timeout: 60_000 });

  for (const [name, path] of [
    ["team", "/team"],
    ["markt", "/markt"],
    ["spieltag", "/spieltag"],
    ["tabelle", "/tabelle"],
    ["historie", "/historie"],
    ["optionen", "/einstellungen"],
  ] as const)
    await visit(page, name, path);

  await visit(page, "team-oben", "/team");
  await page.getByTestId("player-token").first().click();
  await page.waitForTimeout(500);
  shot("team-auswahl");
  await browser.close();
}

void main();
