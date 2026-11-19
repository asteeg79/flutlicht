// Vertrag mit dem Scraper: Das Lebenszeichen, das scraper/fm_scraper/scheduler.status()
// baut, muss zum Schema passen; sonst antwortet die Route 400 und nach 45 Min. meldet
// der Tick fälschlich Stille. Die Datei schreibt und prüft der Python-Test
// test_status_vertrag_mit_der_app.
import { describe, expect, it } from "vitest";
import { ScraperStatus } from "../src";
import contract from "../../scraper/tests/fixtures/status-contract.json" with { type: "json" };

describe("Lebenszeichen des Scrapers", () => {
  it("passt zum Schema, ohne fehlende oder unbekannte Felder", () => {
    const result = ScraperStatus.strict().safeParse(contract);
    expect(result.success ? null : result.error.issues).toBeNull();
  });
});
