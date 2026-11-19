import { describe, expect, it } from "vitest";
import {
  planTick,
  type Fixture,
  type ManagerDoc,
  type MatchdayPoints,
  type ScraperStatus,
  matchdayCalendar,
} from "../src";
import { finalizeManager, type TickInput } from "../src/tick";
import { lineup442, SQUAD_IDS, squadPlayers } from "./helpers";

// Kader aus helpers: je 3 Spieler bei den Vereinen 100–104 (IDs 1–3 → 100, …, 13–15 → 104).
const prefs = { reminder: true, daily: true, final: true };
const subscription = {
  endpoint: "https://push.example/1",
  keys: { p256dh: "p", auth: "a" },
};
const manager = (
  userId: string,
  displayName: string,
  over: Partial<ManagerDoc> = {},
): ManagerDoc => ({
  userId,
  email: `${displayName}@example.org`,
  displayName,
  teamName: `${displayName} FC`,
  passwordHash: "x",
  role: "player",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  firstMatchday: 8,
  squad: SQUAD_IDS,
  cash: 1,
  lineup: lineup442,
  lineupHistory: {},
  transfers: [],
  transferBank: { matchday: 9, available: 2 },
  push: { subscription, prefs },
  ...over,
});
const anna = manager("a", "Anna");
const ben = manager("b", "Ben", { lineup: { ...lineup442, captain: 14 } });
const cleo = manager("c", "Cleo", { squad: [], lineup: null });

const fixture = (
  home: number,
  away: number,
  kickoffUtc: string,
  over: Partial<Fixture> = {},
): Fixture => ({
  matchday: 9,
  openligaMatchId: home,
  homeTeamId: home,
  awayTeamId: away,
  kickoffUtc,
  originalKickoffUtc: kickoffUtc,
  status: "scheduled",
  dataState: "none",
  ...over,
});
// Spieltag 9 am Samstag, 07.11., 15:30 Uhr (Sperre 14:00 Berlin = 13:00 UTC).
const SAT = "2026-11-07T14:30:00Z";
const allClubs = [
  fixture(100, 101, SAT),
  fixture(102, 103, SAT),
  fixture(104, 105, SAT),
];

const points = (
  matchday: number,
  status: MatchdayPoints["status"],
): MatchdayPoints => ({
  matchday,
  status,
  generatedAt: "2026-11-02T08:00:00Z",
  players: Object.fromEntries(
    SQUAD_IDS.map((id) => [
      String(id),
      {
        eventId: 1,
        minutes: 90,
        started: true,
        rating: null,
        parts: {
          rating: 1,
          goals: 0,
          assists: 0,
          cleanSheet: 0,
          conceded: 0,
          penSaved: 0,
          penMissed: 0,
          ownGoals: 0,
          cards: 0,
        },
        base: 1,
      },
    ]),
  ),
});
const finals1to8 = Array.from({ length: 8 }, (_, i) => points(i + 1, "final"));

const input = (over: Partial<TickInput> = {}): TickInput => ({
  now: new Date("2026-11-06T14:00:00Z"), // 23 h vor der ersten Sperre
  done: new Set(
    Array.from({ length: 8 }, (_, i) => `final:${i + 1}`).concat(
      ["a", "b", "c"].map((u) => `finalpush:8:${u}`),
    ),
  ),
  managers: [anna, ben, cleo],
  players: squadPlayers,
  fixtures: [fixture(100, 101, SAT), fixture(102, 103, SAT)],
  points: finals1to8,
  firstScoredMatchday: 8,
  scraper: null,
  ...over,
});
const keys = (i: TickInput) => planTick(i).map((a) => a.key);

describe("Erinnerungen (KONZEPT 9)", () => {
  it("24 h vorher: fehlender Kader und Starter ohne Spiel, nur mit Push", () => {
    // Anna und Ben haben ST 13, 14 (Verein 104) in der Startelf; 104 spielt nicht.
    const actions = planTick(
      input({
        managers: [
          anna,
          ben,
          cleo,
          manager("d", "Dan", { push: undefined, lineup: null }),
        ],
      }),
    );
    expect(actions.map((a) => a.key)).toEqual([
      "remind24:9:a",
      "remind24:9:b",
      "remind24:9:c",
    ]);
    expect(actions[0]).toMatchObject({
      body: "⏰ Noch 24 Std. bis zur ersten Sperre an Spieltag 9 — deine Aufstellung ist unvollständig.",
      url: "/team",
    });
    expect(actions[2]).toMatchObject({
      body: "⏰ Noch 24 Std. bis zur ersten Sperre an Spieltag 9 — du hast noch keinen Kader.",
      url: "/markt",
    });
  });

  it("3 h vorher mit eigenem Schlüssel, danach nicht mehr", () => {
    expect(keys(input({ now: new Date("2026-11-07T10:30:00Z") }))).toEqual([
      "remind3:9:a",
      "remind3:9:b",
      "remind3:9:c",
    ]);
    expect(keys(input({ now: new Date("2026-11-07T13:00:00Z") }))).toEqual([]);
    expect(keys(input({ now: new Date("2026-11-05T12:00:00Z") }))).toEqual([]);
  });

  it("schweigt bei vollständiger Aufstellung, meldet aber inaktive Starter", () => {
    expect(keys(input({ fixtures: allClubs, managers: [anna] }))).toEqual([]);
    const players = squadPlayers.map((p) =>
      p.id === 3 ? { ...p, active: false } : p,
    );
    expect(
      keys(input({ fixtures: allClubs, managers: [anna], players })),
    ).toEqual(["remind24:9:a"]);
  });

  it("respektiert die Push-Einstellung", () => {
    const off = manager("a", "Anna", {
      push: { subscription, prefs: { ...prefs, reminder: false } },
    });
    expect(keys(input({ managers: [off] }))).toEqual([]);
  });
});

describe("Tagesfazit", () => {
  const saturday = [
    fixture(100, 101, SAT, { dataState: "provisional" }),
    fixture(102, 103, SAT, { dataState: "final" }),
  ];
  const at = (utc: string) => ({
    now: new Date(utc),
    fixtures: saturday,
    points: [...finals1to8, points(9, "provisional")],
    managers: [anna, ben],
  });

  it("kommt nach 20 Uhr, wenn alle Spiele des Tages Daten haben", () => {
    const actions = planTick(input(at("2026-11-07T19:30:00Z")));
    expect(actions.map((a) => a.key)).toEqual([
      "daily:2026-11-07:a",
      "daily:2026-11-07:b",
    ]);
    // Anna: 11 × (1 + 2) + Kapitän 3 = 36; Ben ebenso → beide Platz 1
    expect(actions[0]).toMatchObject({
      body: "📊 Samstag: 36 Punkte (vorläufig). Du bist 1. im Spieltag.",
      url: "/spieltag/9",
    });
  });

  it("wartet bis 20 Uhr und auf alle Spiele", () => {
    expect(keys(input(at("2026-11-07T18:59:00Z")))).toEqual([]);
    const pending = {
      ...at("2026-11-07T19:30:00Z"),
      fixtures: [
        saturday[0]!,
        fixture(102, 103, SAT, { dataState: "pending" }),
      ],
    };
    expect(keys(input(pending))).toEqual([]);
  });
});

describe("Finalisierung und Endergebnis", () => {
  it("finalisiert jeden finalen Spieltag einmal und meldet das Ergebnis", () => {
    const actions = planTick(
      input({
        done: new Set(Array.from({ length: 7 }, (_, i) => `final:${i + 1}`)),
        managers: [anna, ben],
      }),
    );
    expect(actions.map((a) => a.key)).toEqual([
      "final:8",
      "remind24:9:a",
      "remind24:9:b",
      "finalpush:8:a",
      "finalpush:8:b",
    ]);
    expect(actions.at(-2)).toMatchObject({
      body: "🏁 Spieltag 8 final: 36 Punkte, Platz 1 gesamt. Spieltagssieger: Anna, Ben (36).",
      url: "/spieltag/8",
    });
  });

  it("führt nichts doppelt aus: mit allen Schlüsseln bleibt der Plan leer", () => {
    const first = input({ done: new Set(), managers: [anna, ben] });
    const done = new Set(planTick(first).map((a) => a.key));
    expect(planTick({ ...first, done })).toEqual([]);
  });
});

describe("Scraper-Alarm", () => {
  const admin = manager("b", "Ben", { role: "admin" });
  // Ben ist Admin. Aufstellung vollständig (allClubs): keine Erinnerung mischt sich in den Plan.
  const quiet: ScraperStatus = {
    pause: null,
    lastJob: null,
    due: [],
    next: [],
    gaveUp: [],
    commit: null,
    unpushed: 0,
  };
  const silent = (seenAt: string | null, over: Partial<TickInput> = {}) =>
    input({
      fixtures: allClubs,
      managers: [anna, admin],
      scraper: seenAt === null ? null : { seenAt, status: quiet },
      ...over,
    });

  it("meldet den Admins einmal je Ausfall, wenn der Heim-Rechner über 45 Min. schweigt", () => {
    const seenAt = "2026-11-06T13:14:00Z"; // 46 Min. vor now
    const actions = planTick(silent(seenAt));
    expect(actions).toEqual([
      {
        kind: "push",
        key: `scraperdown:${seenAt}:b`,
        userId: "b",
        pref: "alarm",
        title: "Scraper meldet sich nicht",
        body: "⚠️ Letztes Lebenszeichen des Heim-Rechners: Fr., 06.11., 14:14 Uhr.",
        url: "/admin",
      },
    ]);
    const done = new Set([...input().done, actions[0]!.key]);
    expect(keys(silent(seenAt, { done }))).toEqual([]);
    // Nach einer neuen Meldung und erneutem Schweigen: neuer Ausfall, neuer Push.
    expect(keys(silent("2026-11-06T13:00:00Z", { done }))).toEqual([
      "scraperdown:2026-11-06T13:00:00Z:b",
    ]);
  });

  it("schweigt bei frischem Lebenszeichen, ohne je eine Meldung und ohne Push-Anmeldung", () => {
    expect(keys(silent("2026-11-06T13:15:00Z"))).toEqual([]); // genau 45 Min.
    expect(keys(silent(null))).toEqual([]);
    const noPush = manager("b", "Ben", { role: "admin", push: undefined });
    expect(
      keys(silent("2026-11-06T10:00:00Z", { managers: [anna, noPush] })),
    ).toEqual([]);
  });

  it("gilt unabhängig von den Push-Einstellungen", () => {
    const off = manager("b", "Ben", {
      role: "admin",
      push: {
        subscription,
        prefs: { reminder: false, daily: false, final: false },
      },
    });
    expect(
      keys(silent("2026-11-06T10:00:00Z", { managers: [off] })),
    ).toHaveLength(1);
  });

  it("meldet eine Sofascore-Pause und aufgegebene Jobs einmal je Vorfall", () => {
    const scraper = {
      seenAt: "2026-11-06T13:58:00Z",
      status: {
        ...quiet,
        pause: {
          until: "2026-11-06T19:41:00Z",
          reason: "429 Too Many Requests",
        },
        gaveUp: [{ key: "final:8", at: "2026-11-06T09:30:00Z" }],
      },
    };
    const actions = planTick(silent(null, { scraper }));
    expect(actions.map((a) => a.key)).toEqual([
      "scraperpause:2026-11-06T19:41:00Z:b",
      "scrapergaveup:final:8:2026-11-06T09:30:00Z:b",
    ]);
    expect(actions[0]).toMatchObject({
      pref: "alarm",
      title: "Scraper pausiert",
      body: "⚠️ 429 Too Many Requests. Pause bis Fr., 06.11., 20:41 Uhr.",
      url: "/admin",
    });
    const done = new Set([...input().done, ...actions.map((a) => a.key)]);
    expect(keys(silent(null, { scraper, done }))).toEqual([]);
  });
});

describe("finalizeManager", () => {
  const NO_BONUS = { firstScoredMatchday: 8, bonus: 0 };
  const md8 = [
    { matchday: 8, kickoffUtc: "2026-10-30T19:30:00Z" },
    { matchday: 9, kickoffUtc: SAT },
  ];
  const finals = new Map([
    [7, new Date("2026-10-26T07:00:00Z")],
    [8, new Date("2026-11-02T07:00:00Z")],
  ]);
  const calendar = matchdayCalendar(
    md8.map((f) => ({
      ...f,
      homeTeamId: 1,
      awayTeamId: 2,
      status: "scheduled" as const,
    })),
    finals,
  );

  it("friert die Aufstellung ein und schreibt die Transferbank fort", () => {
    const doc = manager("a", "Anna", {
      firstMatchday: 7,
      transferBank: { matchday: 8, available: 1 },
    });
    const next = finalizeManager(doc, 8, calendar, NO_BONUS);
    expect(next.lineupHistory["8"]).toEqual(lineup442);
    expect(next.transferBank).toEqual({ matchday: 9, available: 3 });
    // Idempotent: zweiter Aufruf ändert nichts, auch nicht nach Änderung der Aufstellung.
    const again = finalizeManager(
      { ...next, lineup: { ...lineup442, captain: 14 } },
      8,
      calendar,
      NO_BONUS,
    );
    expect(again.lineupHistory["8"]).toEqual(lineup442);
    expect(again.transferBank).toEqual({ matchday: 9, available: 3 });
  });

  it("lässt die Bank nach unbegrenzten Fenstern unverändert", () => {
    const doc = manager("a", "Anna", {
      firstMatchday: 8,
      transferBank: { matchday: 8, available: 2 },
    });
    expect(finalizeManager(doc, 8, calendar, NO_BONUS).transferBank).toEqual({
      matchday: 9,
      available: 2,
    });
  });

  it("friert ohne Aufstellung und vor dem ersten gewerteten Spieltag nichts ein", () => {
    expect(finalizeManager(cleo, 8, calendar, NO_BONUS).lineupHistory).toEqual(
      {},
    );
    expect(
      finalizeManager(
        manager("a", "Anna", { firstMatchday: 9 }),
        8,
        calendar,
        NO_BONUS,
      ).lineupHistory,
    ).toEqual({});
  });
});
