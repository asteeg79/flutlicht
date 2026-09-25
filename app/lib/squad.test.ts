import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultLineup,
  validateLineup,
  type ManagerDoc,
  type Player,
} from "@fm/core";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-squad-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

// NextAuth wird hier nicht gebraucht (die Fehlerklassen kommen aus lib/api-route).
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { buildInitialSquad, makeTransfer } = await import("@/lib/squad");
const storage = await import("@/lib/storage");

/**
 * Markt: TW 1–3, ABW 11–17, MF 21–27, ST 31–35.
 * Vereine so verteilt, dass der Standardkader höchstens 3 je Verein hat.
 */
const P = (
  id: number,
  position: Player["position"],
  teamId: number,
  price: number,
  over: Partial<Player> = {},
): Player => ({
  id,
  name: `Spieler ${id}`,
  shortName: `S${id}`,
  teamId,
  position,
  birthDate: "2000-01-01",
  valueSource: "tm-crawl",
  price,
  purchasable: true,
  active: true,
  ...over,
});
const players: Player[] = [
  P(1, "GK", 1, 4),
  P(2, "GK", 2, 4),
  P(3, "GK", 3, 1),
  P(11, "DEF", 3, 5),
  P(12, "DEF", 4, 5),
  P(13, "DEF", 5, 5),
  P(14, "DEF", 6, 5),
  P(15, "DEF", 1, 5),
  P(16, "DEF", 1, 5),
  P(17, "DEF", 1, 5),
  P(21, "MID", 2, 6),
  P(22, "MID", 3, 6),
  P(23, "MID", 4, 6),
  P(24, "MID", 5, 6),
  P(25, "MID", 6, 6),
  P(26, "MID", 1, 6),
  P(27, "MID", 9, 1, { purchasable: false }),
  P(31, "FWD", 2, 7),
  P(32, "FWD", 3, 7),
  P(33, "FWD", 4, 7),
  P(34, "FWD", 1, 7),
  P(35, "FWD", 7, 30),
];
// 2×4 + 5×5 + 5×6 + 3×7 = 84 Mio. bei 85 Mio. Budget
const SQUAD = [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33];

const fixtures = [
  { matchday: 8, kickoffUtc: "2026-10-30T19:30:00Z" },
  { matchday: 9, kickoffUtc: "2026-11-06T19:30:00Z" },
].map((f, i) => ({
  ...f,
  openligaMatchId: i,
  homeTeamId: 1,
  awayTeamId: 2,
  originalKickoffUtc: f.kickoffUtc,
  status: "scheduled" as const,
  dataState: "none" as const,
}));
const finalsUntil = (last: number, lastAt: string) =>
  new Map(
    Array.from({ length: last }, (_, i) => [
      i + 1,
      new Date(i + 1 === last ? lastAt : "2026-09-01T07:00:00Z"),
    ]),
  );

const ctx = (now: string, finals = finalsUntil(7, "2026-10-26T07:00:00Z")) => ({
  now: new Date(now),
  players,
  fixtures,
  finals,
  startBudget: 85,
  firstScoredMatchday: 8,
});

const UPDATED = "2026-10-01T10:00:00.000Z";
async function saveDoc(over: Partial<ManagerDoc> = {}): Promise<ManagerDoc> {
  const doc: ManagerDoc = {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "tom@example.org",
    displayName: "Tom",
    teamName: "Flutlicht FC",
    passwordHash: "scrypt$x",
    role: "player",
    createdAt: UPDATED,
    updatedAt: UPDATED,
    firstMatchday: 8,
    squad: [],
    cash: 85,
    lineup: null,
    lineupHistory: {},
    transfers: [],
    transferBank: { matchday: 8, available: 2 },
    ...over,
  };
  await storage.saveManager(doc);
  return doc;
}

/** Manager mit fertigem Kader, Fenster zu Spieltag 9 (gezählte Transfers). */
async function withSquad(squad = SQUAD, over: Partial<ManagerDoc> = {}) {
  const picked = squad.map((id) => players.find((p) => p.id === id)!);
  return saveDoc({
    squad,
    cash: 1,
    lineup: defaultLineup(picked),
    transferBank: { matchday: 9, available: 2 },
    ...over,
  });
}
const WINDOW_9 = "2026-11-04T12:00:00Z";
const finals8 = finalsUntil(8, "2026-11-02T07:00:00Z");

describe("POST /api/squad/initial (KONZEPT 2.2, 2.7)", () => {
  it("speichert einen gültigen Erstkader mit Guthaben, Standardaufstellung und Startspieltag", async () => {
    const doc = await saveDoc();
    const m = await buildInitialSquad(
      doc.userId,
      { players: SQUAD, updatedAt: UPDATED },
      ctx("2026-10-28T12:00:00Z"),
    );
    expect(m.squad).toEqual(SQUAD);
    expect(m.cash).toBe(1);
    expect(
      validateLineup(
        m.lineup!,
        players.filter((p) => SQUAD.includes(p.id)),
      ),
    ).toEqual([]);
    expect(m).toMatchObject({
      firstMatchday: 8,
      transferBank: { matchday: 8, available: 2 },
      updatedAt: "2026-10-28T12:00:00.000Z",
    });
    expect("passwordHash" in m).toBe(false);
  });

  it("verschiebt den Startspieltag, wenn dessen erste Sperre schon vorbei ist", async () => {
    const doc = await saveDoc();
    const m = await buildInitialSquad(
      doc.userId,
      { players: SQUAD, updatedAt: UPDATED },
      ctx("2026-10-30T19:00:00Z"),
    );
    expect(m.firstMatchday).toBe(9);
    expect(m.transferBank.matchday).toBe(9);
  });

  it.each([
    [
      "Budget überschritten",
      SQUAD.map((id) => (id === 33 ? 35 : id)),
      "Der Kader ist zu teuer: 107 Mio. bei 85 Mio. Budget.",
    ],
    [
      "6. Spieler eines Vereins",
      [1, 2, 15, 16, 17, 11, 12, 26, 21, 22, 23, 24, 34, 31, 32],
      "Von einem Verein darfst du höchstens 5 Spieler haben.",
    ],
    [
      "falsche Positionen",
      SQUAD.map((id) => (id === 11 ? 26 : id)),
      "Du brauchst genau 5 Abwehrspieler (aktuell 4). Du brauchst genau 5 Mittelfeldspieler (aktuell 6).",
    ],
    [
      "nicht kaufbar",
      SQUAD.map((id) => (id === 21 ? 27 : id)),
      "Dieser Spieler ist derzeit nicht kaufbar.",
    ],
    [
      "unbekannter Spieler",
      SQUAD.map((id) => (id === 21 ? 999 : id)),
      "Unbekannter Spieler.",
    ],
  ])("weist ab: %s", async (_name, squad, message) => {
    const doc = await saveDoc();
    await expect(
      buildInitialSquad(
        doc.userId,
        { players: squad, updatedAt: UPDATED },
        ctx("2026-10-28T12:00:00Z"),
      ),
    ).rejects.toMatchObject({
      status: 400,
      message,
    });
  });

  it("weist einen zweiten Erstkader ab", async () => {
    const doc = await withSquad();
    await expect(
      buildInitialSquad(
        doc.userId,
        { players: SQUAD, updatedAt: UPDATED },
        ctx("2026-10-28T12:00:00Z"),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("antwortet mit 409, wenn der Stand veraltet ist", async () => {
    const doc = await saveDoc();
    await expect(
      buildInitialSquad(
        doc.userId,
        { players: SQUAD, updatedAt: "2026-09-30T10:00:00.000Z" },
        ctx("2026-10-28T12:00:00Z"),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("POST /api/transfer (KONZEPT 2.6, 2.7)", () => {
  const swap = (
    userId: string,
    out: number,
    inId: number,
    updatedAt: string,
    c = ctx(WINDOW_9, finals8),
  ) => makeTransfer(userId, { out, in: inId, updatedAt }, c);

  it("tauscht zum aktuellen Preis auf denselben Platz und zählt einen freien Transfer", async () => {
    const doc = await withSquad();
    const r = await swap(doc.userId, 33, 34, UPDATED);
    expect(r.free).toBe(true);
    expect(r.manager.squad).toContain(34);
    expect(r.manager.cash).toBe(1);
    expect(r.manager.transferBank).toEqual({ matchday: 9, available: 1 });
    expect(r.manager.transfers.at(-1)).toMatchObject({
      matchday: 9,
      out: 33,
      in: 34,
      priceOut: 7,
      priceIn: 7,
      free: true,
    });
  });

  it.each([
    [
      "Fenster zu (erste Sperre vorbei)",
      33,
      34,
      "2026-11-06T18:00:00Z",
      "Das Transferfenster ist geschlossen.",
    ],
    [
      "falsche Position",
      33,
      26,
      WINDOW_9,
      "Du kannst nur Spieler derselben Position tauschen.",
    ],
    [
      "Guthaben reicht nicht",
      31,
      35,
      WINDOW_9,
      "Dein Guthaben reicht für diesen Transfer nicht.",
    ],
    [
      "nicht kaufbar",
      21,
      27,
      WINDOW_9,
      "Dieser Spieler ist derzeit nicht kaufbar.",
    ],
  ])("weist ab: %s", async (_name, out, inId, now, message) => {
    const doc = await withSquad();
    await expect(
      swap(doc.userId, out, inId, UPDATED, ctx(now, finals8)),
    ).rejects.toMatchObject({ status: 400, message });
  });

  it("weist den 6. Spieler eines Vereins ab", async () => {
    const doc = await withSquad([
      1, 2, 15, 16, 17, 11, 12, 26, 21, 22, 23, 24, 31, 32, 33,
    ]);
    await expect(swap(doc.userId, 33, 34, UPDATED)).rejects.toMatchObject({
      message: "Von einem Verein darfst du höchstens 5 Spieler haben.",
    });
  });

  it("zählt: 2 freie Transfers, der dritte kostet Punkte", async () => {
    const doc = await withSquad();
    let updatedAt = UPDATED;
    const free: boolean[] = [];
    for (const [out, inId] of [
      [33, 34],
      [11, 16],
      [12, 17],
    ] as const) {
      const r = await swap(doc.userId, out, inId, updatedAt);
      free.push(r.free);
      updatedAt = r.manager.updatedAt;
    }
    expect(free).toEqual([true, true, false]);
    expect((await storage.loadManager(doc.userId))!.transferBank).toEqual({
      matchday: 9,
      available: 0,
    });
  });

  it("nutzt den Übertrag: mit 3 verfügbaren sind drei Transfers frei", async () => {
    const doc = await withSquad(SQUAD, {
      transferBank: { matchday: 9, available: 3 },
    });
    let updatedAt = UPDATED;
    for (const [out, inId] of [
      [33, 34],
      [11, 16],
      [12, 17],
    ] as const) {
      const r = await swap(doc.userId, out, inId, updatedAt);
      expect(r.free).toBe(true);
      updatedAt = r.manager.updatedAt;
    }
  });

  it("ist in Pausen (≥ 10 Tage) unbegrenzt und lässt die Bank unverändert", async () => {
    const doc = await withSquad(SQUAD, {
      transferBank: { matchday: 9, available: 0 },
    });
    const pause = ctx(
      "2026-10-25T12:00:00Z",
      finalsUntil(8, "2026-10-20T07:00:00Z"),
    );
    const r = await swap(doc.userId, 33, 34, UPDATED, pause);
    expect(r.free).toBe(true);
    expect(r.manager.transferBank).toEqual({ matchday: 9, available: 0 });
  });

  it("ist vor dem ersten gewerteten Spieltag unbegrenzt", async () => {
    const doc = await withSquad(SQUAD, {
      firstMatchday: 9,
      transferBank: { matchday: 9, available: 0 },
    });
    expect((await swap(doc.userId, 33, 34, UPDATED)).free).toBe(true);
  });

  it("antwortet mit 409, wenn der Stand veraltet ist", async () => {
    const doc = await withSquad();
    await expect(
      swap(doc.userId, 33, 34, "2026-09-30T10:00:00.000Z"),
    ).rejects.toMatchObject({ status: 409 });
  });
});
