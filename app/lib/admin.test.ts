import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Fixture } from "@fm/core";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-admin-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

const admin = await import("@/lib/admin");
const storage = await import("@/lib/storage");
const { Upstream } = await import("@/lib/errors");
const { saveDoc } = await import("@/test/fixtures");
import type { GitHub } from "@/lib/github";

/** GitHub im Speicher: Dateien mit sha, Commits und Dispatches werden mitgeschrieben. */
function fakeGitHub(files: Record<string, unknown> = {}) {
  const store = new Map(
    Object.entries(files).map(([p, data], i) => [p, { data, sha: `sha${i}` }]),
  );
  const commits: {
    path: string;
    message: string;
    sha?: string;
    data: unknown;
  }[] = [];
  const dispatches: string[] = [];
  const gh: GitHub = {
    async getJson<T>(path: string) {
      const f = store.get(path);
      return f ? { data: f.data as T, sha: f.sha } : null;
    },
    async putJson(path, data, message, sha) {
      commits.push({ path, message, ...(sha ? { sha } : {}), data });
      store.set(path, { data, sha: `sha-${commits.length}` });
    },
    async dispatch(eventType) {
      dispatches.push(eventType);
    },
    async lastCommit() {
      return {
        date: "2026-11-07T20:00:00Z",
        message: "raw: match-provisional",
      };
    },
    async lastRun() {
      return {
        status: "completed",
        conclusion: "success",
        createdAt: "2026-11-07T20:01:00Z",
        url: "https://x",
      };
    },
  };
  return { gh, commits, dispatches, store };
}

const NOW = new Date("2026-10-20T12:00:00Z");
const fixture = (
  matchday: number,
  kickoffUtc: string,
  over: Partial<Fixture> = {},
): Fixture => ({
  matchday,
  openligaMatchId: matchday,
  sofascoreEventId: 700 + matchday,
  homeTeamId: 1,
  awayTeamId: 2,
  kickoffUtc,
  originalKickoffUtc: kickoffUtc,
  status: "scheduled",
  dataState: "none",
  ...over,
});
const fixtures = [
  fixture(4, "2026-09-20T13:30:00Z", {
    status: "finished",
    dataState: "pending",
  }),
  fixture(8, "2026-10-30T19:30:00Z"),
  fixture(9, "2026-11-06T19:30:00Z"),
];
const finals = new Map(
  [1, 2, 3, 4, 5, 6, 7].map((n) => [n, new Date("2026-10-12T07:00:00Z")]),
);
const season = (now = NOW) => ({
  now,
  fixtures,
  finals,
  firstScoredMatchday: 8,
});

describe("Einladungs- und Reset-Codes", () => {
  it("erzeugt Codes im vorgegebenen Alphabet und widerruft sie", async () => {
    const code = await admin.createInvite(NOW);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    await admin.revokeInvite({ code: code.toLowerCase() });
    expect((await storage.loadLeague()).invites).toEqual([
      { code, createdAt: NOW.toISOString(), revoked: true },
    ]);
    await expect(
      admin.revokeInvite({ code: "NOPE2345" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("erzeugt Reset-Codes nur für bestehende Konten", async () => {
    const doc = await saveDoc();
    const code = await admin.createResetCode({ userId: doc.userId }, NOW);
    expect((await storage.loadLeague()).resets).toEqual([
      { code, userId: doc.userId, createdAt: NOW.toISOString() },
    ]);
    await expect(
      admin.createResetCode(
        { userId: "22222222-2222-4222-8222-222222222222" },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("Konto löschen", () => {
  it("entfernt Dokument und E-Mail-Index, aber nie das eigene Konto", async () => {
    const doc = await saveDoc();
    await storage.saveEmailIndex({
      [doc.email]: doc.userId,
      "x@example.org": "33333333-3333-4333-8333-333333333333",
    });
    await expect(
      admin.deleteAccount({ userId: doc.userId }, doc.userId),
    ).rejects.toMatchObject({ status: 403 });
    await admin.deleteAccount(
      { userId: doc.userId },
      "33333333-3333-4333-8333-333333333333",
    );
    expect(await storage.loadManager(doc.userId)).toBeNull();
    expect(await storage.loadEmailIndex()).toEqual({
      "x@example.org": "33333333-3333-4333-8333-333333333333",
    });
  });
});

describe("raw/manual/ per Commit (KONZEPT 11)", () => {
  it("ergänzt die Zuordnung, mit sha gegen gleichzeitige Änderungen", async () => {
    const doc = await saveDoc();
    const { gh, commits } = fakeGitHub({
      "raw/manual/mapping.json": { "5": "77" },
    });
    await admin.applyManualChange(
      gh,
      { kind: "mapping", playerId: 12, tmId: "4711" },
      doc,
      season(),
    );
    await admin.applyManualChange(
      gh,
      { kind: "mapping", playerId: 13, tmId: null },
      doc,
      season(),
    );
    expect(commits[0]).toEqual({
      path: "raw/manual/mapping.json",
      message: "raw(manual): Zuordnung Spieler 12 → TM 4711 (Admin Tom)",
      sha: "sha0",
      data: { "5": "77", "12": "4711" },
    });
    expect(commits[1]!.data).toEqual({ "5": "77", "12": "4711", "13": null });
  });

  it("setzt Marktwerte und Positionen", async () => {
    const doc = await saveDoc();
    const { gh, commits } = fakeGitHub();
    await admin.applyManualChange(
      gh,
      { kind: "value", playerId: 12, valueEur: 250000 },
      doc,
      season(),
    );
    await admin.applyManualChange(
      gh,
      { kind: "position", playerId: 12, position: "DEF" },
      doc,
      season(),
    );
    expect(commits.map((c) => [c.path, c.data])).toEqual([
      ["raw/manual/values.json", { "12": 250000 }],
      ["raw/manual/positions.json", { "12": "DEF" }],
    ]);
    await expect(
      admin.applyManualChange(
        gh,
        { kind: "position", playerId: 12, position: "ST" },
        doc,
        season(),
      ),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("ändert den Saisonstart nur vor dem ersten gewerteten Spieltag", async () => {
    const doc = await saveDoc();
    const { gh, commits } = fakeGitHub({
      "raw/manual/season.json": { firstScoredMatchday: 8 },
    });
    await admin.applyManualChange(
      gh,
      { kind: "season", firstScoredMatchday: 9, startBudget: 80 },
      doc,
      season(),
    );
    expect(commits[0]).toMatchObject({
      data: { firstScoredMatchday: 9, startBudget: 80 },
      sha: "sha0",
    });
    await expect(
      admin.applyManualChange(
        gh,
        { kind: "season", firstScoredMatchday: 4 },
        doc,
        season(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      admin.applyManualChange(
        gh,
        { kind: "season", firstScoredMatchday: 9 },
        doc,
        season(new Date("2026-10-30T18:00:00Z")),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("Saisonstart vorziehen: alle Konten zählen ab dem neuen Spieltag (KONZEPT 2.8)", async () => {
    // Laufend ist Spieltag 5 (1–4 final), Saisonstart war 8; beide Konten stehen deshalb auf 8.
    const early = {
      now: new Date("2026-10-01T12:00:00Z"),
      fixtures: [
        fixture(5, "2026-10-09T18:30:00Z"),
        fixture(8, "2026-10-30T19:30:00Z"),
      ],
      finals: new Map(
        [1, 2, 3, 4].map((n) => [n, new Date("2026-09-28T07:00:00Z")]),
      ),
      firstScoredMatchday: 8,
    };
    const tom = await saveDoc();
    await saveDoc({
      userId: "22222222-2222-4222-8222-222222222222",
      email: "ida@example.org",
      displayName: "Ida",
    });
    const { gh, commits } = fakeGitHub({
      "raw/manual/season.json": { firstScoredMatchday: 8 },
    });
    await admin.applyManualChange(
      gh,
      { kind: "season", firstScoredMatchday: 5 },
      tom,
      early,
    );
    expect(commits[0]).toMatchObject({ data: { firstScoredMatchday: 5 } });
    const docs = await storage.listAllManagers();
    expect(docs).toHaveLength(2);
    for (const d of docs) {
      expect(d.firstMatchday).toBe(5);
      expect(d.transferBank).toEqual({ matchday: 5, available: 2 });
      expect(d.updatedAt).toBe(early.now.toISOString());
    }
  });

  it("Saisonstart nach hinten: Konten ziehen mit", async () => {
    const doc = await saveDoc();
    const { gh } = fakeGitHub({
      "raw/manual/season.json": { firstScoredMatchday: 8 },
    });
    await admin.applyManualChange(
      gh,
      { kind: "season", firstScoredMatchday: 9 },
      doc,
      season(),
    );
    const [d] = await storage.listAllManagers();
    expect(d).toMatchObject({
      firstMatchday: 9,
      transferBank: { matchday: 9, available: 2 },
    });
  });

  it("trägt ein Spiel nach und vermerkt, wer und wann", async () => {
    const doc = await saveDoc();
    const { gh, commits } = fakeGitHub();
    const row = {
      started: true,
      minutes: 90,
      rating: 7.1,
      goals: 1,
      assists: 0,
      ownGoals: 0,
      yellow: false,
      yellowRed: false,
      red: false,
      penMissed: 0,
      penSaved: 0,
    };
    const path = await admin.saveManualMatch(
      gh,
      {
        eventId: 704,
        score: { home: 1, away: 0 },
        players: [{ ...row, playerId: 1 }],
      },
      doc,
      NOW,
      fixtures,
    );
    expect(path).toBe("raw/manual/matches/704.json");
    expect(commits[0]).toMatchObject({
      message: "raw(manual): Nachtrag Spiel 704 (Spieltag 4) (Admin Tom)",
      data: {
        eventId: 704,
        enteredBy: "Tom",
        enteredAt: NOW.toISOString(),
        score: { home: 1, away: 0 },
      },
    });
    const dup = {
      eventId: 704,
      score: { home: 1, away: 0 },
      players: [
        { ...row, playerId: 1 },
        { ...row, playerId: 1 },
      ],
    };
    await expect(
      admin.saveManualMatch(gh, dup, doc, NOW, fixtures),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      admin.saveManualMatch(gh, { ...dup, eventId: 999 }, doc, NOW, fixtures),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      admin.saveManualMatch(gh, { eventId: 704 }, doc, NOW, fixtures),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("startet die Neuberechnung und fasst den Status zusammen", async () => {
    const { gh, dispatches } = fakeGitHub();
    await admin.recompute(gh);
    expect(dispatches).toEqual(["recompute"]);
    const tickDone = {
      "final:7": "2026-10-12T08:00:00Z",
      "remind24:8:x": "2026-10-29T20:00:00Z",
    };
    const seenAt = "2026-10-30T10:00:00Z";
    const scraper = {
      seenAt,
      status: {
        pause: {
          until: "2026-10-30T15:41:00Z",
          reason: "429 Too Many Requests",
        },
        lastJob: null,
        due: [{ key: "squads:2026-10-29", attempts: 1 }],
        next: [],
        gaveUp: [],
        commit: "5cfb8a4",
        unpushed: 0,
        route: "page",
      },
    };
    const status = await admin.adminStatus(
      gh,
      fixtures,
      tickDone,
      scraper,
      new Date("2026-10-30T10:45:00Z"),
    );
    expect(status).toMatchObject({
      heartbeat: { at: seenAt, silent: false, status: scraper.status },
      pending: 1,
      scraper: { message: "raw: match-provisional" },
      compute: { conclusion: "success" },
    });
    expect(status.tick).toEqual({
      key: "remind24:8:x",
      at: "2026-10-29T20:00:00Z",
    });
    // Über 45 Min. ohne Lebenszeichen: der Scraper gilt als still.
    const later = await admin.adminStatus(
      gh,
      fixtures,
      tickDone,
      scraper,
      new Date("2026-10-30T10:46:00Z"),
    );
    expect(later.heartbeat).toMatchObject({ at: seenAt, silent: true });
  });

  it("zeigt den Status auch ohne GitHub, mit Hinweis statt 502", async () => {
    const { gh } = fakeGitHub();
    const broken: GitHub = {
      ...gh,
      async lastCommit() {
        throw new Upstream(
          "GitHub ist nicht eingerichtet (GITHUB_PAT, GITHUB_REPO).",
        );
      },
    };
    const status = await admin.adminStatus(
      broken,
      fixtures,
      { "final:7": "2026-10-12T08:00:00Z" },
      null,
      new Date("2026-10-30T10:00:00Z"),
    );
    expect(status).toMatchObject({
      github: "GitHub ist nicht eingerichtet (GITHUB_PAT, GITHUB_REPO).",
      heartbeat: null,
      scraper: null,
      compute: null,
      fixtures: null,
      pending: 1,
    });
    expect(status.tick).toEqual({ key: "final:7", at: "2026-10-12T08:00:00Z" });
  });
});

describe("withAdmin", () => {
  it("weist Nicht-Admins mit 403 ab", async () => {
    const player = await saveDoc();
    vi.doMock("@/lib/auth", () => ({
      auth: async () => ({ user: { id: player.userId } }),
    }));
    vi.resetModules();
    const { GET } = await import("@/app/api/admin/invites/route");
    const res = await GET(new Request("http://x/api/admin/invites"));
    expect(res.status).toBe(403);
    await storage.saveManager({ ...player, role: "admin" });
    expect((await GET(new Request("http://x/api/admin/invites"))).status).toBe(
      200,
    );
    vi.doUnmock("@/lib/auth");
  });
});
