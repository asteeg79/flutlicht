import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchdayPoints } from "@fm/core";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-tick-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
  vi.stubEnv("CRON_SECRET", "tick-geheim");
});
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { runTick } = await import("@/lib/tick");
const storage = await import("@/lib/storage");
const { players, SQUAD, withSquad } = await import("@/test/fixtures");

const subscription = {
  endpoint: "https://push.example/1",
  keys: { p256dh: "p", auth: "a" },
};
const prefs = { reminder: true, daily: true, final: true };

// Spieltag 8 ist final, Spieltag 9 beginnt Freitag (Sperre 18:00 UTC).
const md8: MatchdayPoints = {
  matchday: 8,
  status: "final",
  generatedAt: "2026-11-02T07:00:00Z",
  players: Object.fromEntries(
    SQUAD.map((id) => [
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
};
const fixtures = [
  { matchday: 8, kickoffUtc: "2026-10-30T19:30:00Z", home: 1, away: 2 },
  { matchday: 9, kickoffUtc: "2026-11-06T19:30:00Z", home: 1, away: 2 },
].map((f, i) => ({
  matchday: f.matchday,
  openligaMatchId: i,
  homeTeamId: f.home,
  awayTeamId: f.away,
  kickoffUtc: f.kickoffUtc,
  originalKickoffUtc: f.kickoffUtc,
  status: "scheduled" as const,
  dataState: "none" as const,
}));
// Spieltage 1–7 sind ebenfalls final (Backfill), ohne Punkte für den Test-Kader.
const earlier = Array.from({ length: 7 }, (_, i): MatchdayPoints => ({
  ...md8,
  matchday: i + 1,
  players: {},
}));
const game = {
  players,
  fixtures,
  points: [...earlier, md8],
  season: { firstScoredMatchday: 8 },
} as never;
// Finalisierungszeiten wie in der App aus den Spieltagsdateien: 7 am 26.10., 8 am 02.11.
const finals = () =>
  new Map([
    [7, new Date("2026-10-26T07:00:00Z")],
    [8, new Date("2026-11-02T07:00:00Z")],
  ]);
const NOW = new Date("2026-11-06T08:00:00Z"); // 10 h vor der ersten Sperre von Spieltag 9

describe("runTick (Abnahme M9)", () => {
  it("finalisiert, erinnert und meldet – und ein zweiter Tick sendet nichts doppelt", async () => {
    // Verein 3–6 spielen an Spieltag 9 nicht → Aufstellung unvollständig → Erinnerung.
    const doc = await withSquad(SQUAD, {
      firstMatchday: 7,
      transferBank: { matchday: 8, available: 0 },
      push: { subscription, prefs },
    });
    const send = vi.fn(
      async (_s: unknown, _p: { tag?: string }) => "sent" as const,
    );

    const first = await runTick(NOW, game, send, finals);
    expect(first).toEqual({
      finalized: [1, 2, 3, 4, 5, 6, 7, 8],
      sent: 2,
      failed: 0,
      expired: 0,
    });
    expect(send.mock.calls.map(([, p]) => (p as { tag: string }).tag)).toEqual([
      `remind24:9:${doc.userId}`,
      `finalpush:8:${doc.userId}`,
    ]);

    const saved = (await storage.loadManager(doc.userId))!;
    // Eingefroren ab dem ersten Spieltag des Managers (7).
    expect(saved.lineupHistory).toEqual({ "7": doc.lineup, "8": doc.lineup });
    expect(saved.transferBank).toEqual({ matchday: 9, available: 2 });
    expect(saved.updatedAt).toBe(doc.updatedAt); // server-eigen, keine 409 für den Manager

    const second = await runTick(
      new Date(NOW.getTime() + 10 * 60_000),
      game,
      send,
      finals,
    );
    expect(second).toEqual({ finalized: [], sent: 0, failed: 0, expired: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(Object.keys((await storage.loadSystemState()).done).sort()).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8]
        .map((n) => `final:${n}`)
        .concat([`finalpush:8:${doc.userId}`, `remind24:9:${doc.userId}`])
        .sort(),
    );
  });

  it("friert beim Finalisieren die damalige Aufstellung ein, spätere Änderungen nicht", async () => {
    const doc = await withSquad(SQUAD, { firstMatchday: 8 });
    await runTick(
      NOW,
      game,
      vi.fn(async (_s: unknown, _p: { tag?: string }) => "sent" as const),
      finals,
    );
    const changed = {
      ...(await storage.loadManager(doc.userId))!,
      lineup: { ...doc.lineup!, captain: 32 },
    };
    await storage.saveManager(changed);
    await runTick(
      new Date(NOW.getTime() + 10 * 60_000),
      game,
      vi.fn(async (_s: unknown, _p: { tag?: string }) => "sent" as const),
      finals,
    );
    const saved = (await storage.loadManager(doc.userId))!;
    expect(saved.lineupHistory["8"]!.captain).toBe(doc.lineup!.captain);
    expect(saved.lineup!.captain).toBe(32);
  });

  it("schreibt die Spieltagsprämie über dem Median gut, genau einmal (2.7)", async () => {
    const a = await withSquad(SQUAD, {
      transferBank: { matchday: 8, available: 2 },
    });
    const star = a.lineup!.captain;
    const other = a.lineup!.starters.find((id) => id !== star)!;
    const b = await withSquad(SQUAD, {
      userId: "22222222-2222-4222-8222-222222222222",
      email: "ben@example.org",
      lineup: { ...a.lineup!, captain: other },
      transferBank: { matchday: 8, available: 2 },
    });
    // Der Kapitän von a holt 30 statt 1: +29 Basis, doppelt gezählt → a liegt 29 Punkte vor b.
    const md = {
      ...md8,
      players: {
        ...md8.players,
        [String(star)]: { ...md8.players[String(star)]!, base: 30 },
      },
    };
    const g = { ...(game as object), points: [...earlier, md] } as never;
    const send = vi.fn(async () => "sent" as const);
    await runTick(NOW, g, send, finals);
    // Median (a+b)/2 → a liegt 14,5 darüber → 0,29 → 0,3 Mio.
    expect((await storage.loadManager(a.userId))!.cash).toBe(1.3);
    expect((await storage.loadManager(a.userId))!.matchdayBonuses).toEqual({
      "8": 0.3,
    });
    expect((await storage.loadManager(b.userId))!.cash).toBe(1);
    await runTick(new Date(NOW.getTime() + 10 * 60_000), g, send, finals);
    expect((await storage.loadManager(a.userId))!.cash).toBe(1.3);
  });

  it("meldet dem Admin einen stillen Scraper genau einmal je Ausfall", async () => {
    const adminDoc = await withSquad(SQUAD, {
      role: "admin",
      push: { subscription, prefs },
    });
    await storage.saveScraperHeartbeat({
      seenAt: "2026-11-06T07:00:00Z", // 1 h vor NOW
      status: {
        pause: null,
        lastJob: null,
        due: [],
        next: [],
        gaveUp: [],
        commit: null,
        unpushed: 0,
      },
    });
    const send = vi.fn(
      async (_s: unknown, _p: { tag?: string }) => "sent" as const,
    );
    const alarms = () =>
      send.mock.calls
        .map(([, p]) => (p as { tag: string }).tag)
        .filter((tag) => tag.startsWith("scraperdown:"));

    await runTick(NOW, game, send, finals);
    expect(alarms()).toEqual([
      `scraperdown:2026-11-06T07:00:00Z:${adminDoc.userId}`,
    ]);
    await runTick(new Date(NOW.getTime() + 10 * 60_000), game, send, finals);
    expect(alarms()).toHaveLength(1);
  });

  it("entfernt abgelaufene Subscriptions", async () => {
    const doc = await withSquad(SQUAD, { push: { subscription, prefs } });
    const r = await runTick(
      NOW,
      game,
      vi.fn(async (_s: unknown, _p: { tag?: string }) => "expired" as const),
      finals,
    );
    expect(r.expired).toBeGreaterThan(0);
    expect((await storage.loadManager(doc.userId))!.push).toBeUndefined();
  });
});

describe("POST /api/cron/tick", () => {
  it("verlangt den Bearer CRON_SECRET", async () => {
    const { POST } = await import("@/app/api/cron/tick/route");
    const bad = await POST(
      new Request("http://x/api/cron/tick", {
        method: "POST",
        headers: { authorization: "Bearer falsch" },
      }),
    );
    expect(bad.status).toBe(401);
    const none = await POST(
      new Request("http://x/api/cron/tick", { method: "POST" }),
    );
    expect(none.status).toBe(401);
  });
});
