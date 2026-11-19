import { describe, expect, it } from "vitest";
import {
  awaitingData,
  DATA_ALARM_AFTER_MS,
  DATA_HINT_AFTER_MS,
  scraperSilent,
  type Fixture,
  type ScraperStatus,
} from "../src";
import { MATCH_DURATION_MS, scraperAlarms } from "../src/freshness";

const f = (dataState: Fixture["dataState"]): Fixture => ({
  matchday: 5,
  openligaMatchId: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  kickoffUtc: "2026-10-10T13:30:00Z",
  originalKickoffUtc: "2026-10-10T13:30:00Z",
  status: "finished",
  dataState,
});
const HOUR = 60 * 60 * 1000;

describe("awaitingData", () => {
  it("meldet Spiele ohne Daten nach Spielende plus Frist, bis zum Ende des Fensters", () => {
    const grace = 1.5 * HOUR; // Frische-Banner: 90 Min. nach Spielende
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-10T17:00:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toEqual([]);
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-10T17:01:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toHaveLength(1);
    expect(
      awaitingData(
        [f("pending")],
        new Date("2026-10-13T13:31:00Z"),
        grace,
        72 * HOUR,
      ),
    ).toEqual([]);
  });
  it("ignoriert Spiele mit Daten", () => {
    expect(
      awaitingData(
        [f("provisional")],
        new Date("2026-10-10T20:00:00Z"),
        0,
        72 * HOUR,
      ),
    ).toEqual([]);
  });
});

describe("scraperSilent", () => {
  const seenAt = "2026-10-10T12:00:00Z";
  it("gilt erst nach mehr als 45 Min. ohne Lebenszeichen", () => {
    expect(scraperSilent(seenAt, new Date("2026-10-10T12:45:00Z"))).toBe(false);
    expect(scraperSilent(seenAt, new Date("2026-10-10T12:45:01Z"))).toBe(true);
  });
  it("gilt nicht, solange sich der Heim-Rechner nie gemeldet hat", () => {
    expect(scraperSilent(null, new Date("2026-10-10T12:45:01Z"))).toBe(false);
  });
});

describe("scraperAlarms", () => {
  const seenAt = "2026-10-10T12:00:00Z";
  const now = new Date("2026-10-10T12:05:00Z");
  const quiet: ScraperStatus = {
    pause: null,
    lastJob: null,
    due: [],
    next: [],
    gaveUp: [],
    commit: "5cfb8a4",
    unpushed: 0,
  };
  const keys = (status: ScraperStatus, at = now) =>
    scraperAlarms({ seenAt, status }, at).map((a) => a.key);

  it("meldet nichts ohne Lebenszeichen und bei unauffälligem Stand", () => {
    expect(scraperAlarms(null, now)).toEqual([]);
    expect(keys(quiet)).toEqual([]);
  });

  it("meldet eine laufende Pause mit Grund und Ende, eine abgelaufene nicht", () => {
    const pause = {
      until: "2026-10-10T18:00:00.585114+00:00",
      reason: "wiederholt 403/Bot-Challenge bei https://x/team/2671/players",
    };
    expect(scraperAlarms({ seenAt, status: { ...quiet, pause } }, now)).toEqual(
      [
        {
          key: "scraperpause:2026-10-10T18:00:00.585114+00:00",
          title: "Scraper pausiert",
          body: "⚠️ wiederholt 403/Bot-Challenge bei https://x/team/2671/players. Pause bis Sa., 10.10., 20:00 Uhr.",
        },
      ],
    );
    const past = { until: "2026-10-10T12:00:00Z", reason: null };
    expect(keys({ ...quiet, pause: past })).toEqual([]);
  });

  it("meldet jeden aufgegebenen Job", () => {
    const gaveUp = [
      { key: "final:5", at: "2026-10-10T08:30:00Z" },
      { key: "prov:501", at: "2026-10-09T21:30:00Z" },
    ];
    expect(
      scraperAlarms({ seenAt, status: { ...quiet, gaveUp } }, now),
    ).toEqual([
      {
        key: "scrapergaveup:final:5:2026-10-10T08:30:00Z",
        title: "Scraper-Job aufgegeben",
        body: "⚠️ final:5 wurde nach mehreren Versuchen aufgegeben.",
      },
      {
        key: "scrapergaveup:prov:501:2026-10-09T21:30:00Z",
        title: "Scraper-Job aufgegeben",
        body: "⚠️ prov:501 wurde nach mehreren Versuchen aufgegeben.",
      },
    ]);
  });

  it("meldet bei Stille nur die Stille: der Stand ist dann veraltet", () => {
    const pause = { until: "2026-10-10T18:00:00Z", reason: null };
    expect(
      scraperAlarms(
        { seenAt, status: { ...quiet, pause } },
        new Date("2026-10-10T12:45:01Z"),
      ),
    ).toEqual([
      {
        key: `scraperdown:${seenAt}`,
        title: "Scraper meldet sich nicht",
        body: "⚠️ Letztes Lebenszeichen des Heim-Rechners: Sa., 10.10., 14:00 Uhr.",
      },
    ]);
  });
});

describe("Staffelung „Daten überfällig“ (Entscheidung 19.11.)", () => {
  it("Hinweis nach dem letzten Abrufversuch des Scrapers, Alarm danach", () => {
    const MIN = 60 * 1000;
    // Scraper: vorläufige Daten bis 155 Min. nach Anpfiff, dann höchstens 3 × 15 Min.
    const lastAttempt = (155 + 3 * 15) * MIN;
    expect(MATCH_DURATION_MS + DATA_HINT_AFTER_MS).toBeGreaterThan(lastAttempt);
    expect(DATA_ALARM_AFTER_MS).toBeGreaterThan(DATA_HINT_AFTER_MS);
  });
});
