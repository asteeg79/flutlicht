import { describe, expect, it } from "vitest";
import {
  applyTransfer,
  cashAfterTransfer,
  currentMatchday,
  isBreakWindow,
  rollTransferBank,
  scoreManager,
  transferQuote,
  transferViolation,
  transferWindow,
  type OpenTransferWindow,
  type TransferPlayer,
  type TransferState,
} from "../src";
import {
  SQUAD_IDS,
  lineup442,
  positionOf,
  positions,
  squadPlayers,
} from "./helpers";

const fixtures = [
  { matchday: 8, kickoffUtc: "2026-10-17T13:30:00Z" },
  { matchday: 8, kickoffUtc: "2026-10-18T15:30:00Z" },
  { matchday: 9, kickoffUtc: "2026-10-24T13:30:00Z" },
];
const finalsUntil = (md: number, lastAt: string) =>
  new Map(
    Array.from({ length: md }, (_, i) => [
      i + 1,
      new Date(i + 1 === md ? lastAt : "2026-08-01T07:00:00Z"),
    ]),
  );

describe("currentMatchday", () => {
  it("ist der kleinste nicht finale Spieltag", () => {
    expect(currentMatchday(new Map())).toBe(1);
    expect(currentMatchday(finalsUntil(7, "2026-10-12T07:00:00Z"))).toBe(8);
    expect(currentMatchday(finalsUntil(34, "2027-05-24T07:00:00Z"))).toBeNull();
  });
});

describe("transferWindow (KONZEPT 2.6)", () => {
  const finals = finalsUntil(7, "2026-10-12T07:00:00Z");

  it("ist zwischen Finalisierung und erster Sperre offen", () => {
    const w = transferWindow(
      fixtures,
      finals,
      new Date("2026-10-14T10:00:00Z"),
    );
    expect(w).toEqual({
      open: true,
      matchday: 8,
      closesAt: new Date("2026-10-17T12:00:00Z"),
      isBreak: false,
    });
  });

  it("ist ab der ersten Sperre geschlossen", () => {
    expect(
      transferWindow(fixtures, finals, new Date("2026-10-17T12:00:00Z")),
    ).toEqual({ open: false });
  });

  it("erkennt eine Pause ab 10 Tagen", () => {
    const w = transferWindow(
      fixtures,
      finalsUntil(7, "2026-10-07T12:00:00Z"),
      new Date("2026-10-10T00:00:00Z"),
    );
    expect(w).toMatchObject({ open: true, isBreak: true });
    expect(
      isBreakWindow(
        new Date("2026-10-07T12:00:01Z"),
        new Date("2026-10-17T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("zählt den Saisonstart als Pause", () => {
    const w = transferWindow(
      [{ matchday: 1, kickoffUtc: "2026-08-28T18:30:00Z" }],
      new Map(),
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(w).toMatchObject({ open: true, matchday: 1, isBreak: true });
  });

  it("ist geschlossen, wenn die Saison vorbei ist oder Spiele fehlen", () => {
    expect(
      transferWindow(
        fixtures,
        finalsUntil(34, "2027-05-24T07:00:00Z"),
        new Date(),
      ),
    ).toEqual({ open: false });
    expect(
      transferWindow([], finals, new Date("2026-10-14T10:00:00Z")),
    ).toEqual({ open: false });
  });
});

const openWindow: OpenTransferWindow = {
  open: true,
  matchday: 8,
  closesAt: new Date("2026-10-17T12:00:00Z"),
  isBreak: false,
};

describe("transferQuote und rollTransferBank (Zählung und Übertrag)", () => {
  it("ist vor dem ersten gewerteten Spieltag des Managers unbegrenzt", () => {
    expect(transferQuote({ matchday: 8, available: 0 }, openWindow, 8)).toEqual(
      { unlimited: true, nextCost: 0 },
    );
  });

  it("ist in Pausen unbegrenzt", () => {
    expect(
      transferQuote(
        { matchday: 8, available: 0 },
        { ...openWindow, isBreak: true },
        3,
      ).unlimited,
    ).toBe(true);
  });

  it("meldet freie Transfers und danach −5", () => {
    expect(transferQuote({ matchday: 8, available: 2 }, openWindow, 3)).toEqual(
      { unlimited: false, freeLeft: 2, nextCost: 0 },
    );
    expect(transferQuote({ matchday: 8, available: 0 }, openWindow, 3)).toEqual(
      { unlimited: false, freeLeft: 0, nextCost: 5 },
    );
  });

  it.each([
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 3],
  ])("verfügbar(N+1) = 2 + min(1, ungenutzt = %d) = %d", (unused, next) => {
    expect(rollTransferBank({ matchday: 8, available: unused }, false)).toEqual(
      { matchday: 9, available: next },
    );
  });

  it("lässt den Stand nach einem unbegrenzten Fenster unverändert", () => {
    expect(rollTransferBank({ matchday: 8, available: 2 }, true)).toEqual({
      matchday: 9,
      available: 2,
    });
  });
});

describe("applyTransfer (KONZEPT 2.3, 2.6, 2.7)", () => {
  const market: TransferPlayer[] = [
    {
      id: 101,
      position: "FWD",
      teamId: 200,
      price: 4.3,
      purchasable: true,
      active: true,
    },
    {
      id: 102,
      position: "DEF",
      teamId: 201,
      price: 3.0,
      purchasable: true,
      active: true,
    },
    {
      id: 103,
      position: "FWD",
      teamId: 100,
      price: 1.0,
      purchasable: true,
      active: true,
    },
    {
      id: 104,
      position: "FWD",
      teamId: 202,
      price: 1.0,
      purchasable: false,
      active: true,
    },
    {
      id: 105,
      position: "FWD",
      teamId: 202,
      price: 1.0,
      purchasable: true,
      active: false,
    },
    {
      id: 106,
      position: "FWD",
      teamId: 203,
      price: 4.4,
      purchasable: true,
      active: true,
    },
  ];
  const players = new Map([...squadPlayers, ...market].map((p) => [p.id, p]));
  const state: TransferState & { userId: string } = {
    userId: "u1",
    squad: SQUAD_IDS,
    cash: 0.3,
    lineup: lineup442,
    transfers: [],
    transferBank: { matchday: 8, available: 2 },
    firstMatchday: 3,
  };
  const ctx = {
    players,
    window: openWindow,
    now: new Date("2026-10-14T10:00:00Z"),
  };
  const code = (r: ReturnType<typeof applyTransfer>) =>
    r.ok ? "ok" : r.violations[0]!.code;

  it("transferViolation prüft wie applyTransfer, ohne zu buchen (Markt-Vorschau)", () => {
    expect(transferViolation(state, 14, 101, ctx)).toBeNull();
    expect(transferViolation({ ...state, cash: 0 }, 14, 101, ctx)?.code).toBe(
      "cash",
    );
    expect(state.transferBank.available).toBe(2);
  });

  it("tauscht auf denselben Platz, bucht Guthaben exakt und zählt einen freien Transfer", () => {
    const r = applyTransfer(state, 14, 101, ctx);
    if (!r.ok) throw new Error(r.violations[0]!.message);
    expect(r.state.userId).toBe("u1");
    expect(r.state.squad).toContain(101);
    expect(r.state.squad).not.toContain(14);
    expect(r.state.lineup!.starters[10]).toBe(101);
    expect(r.state.cash).toBe(0);
    expect(r.state.transferBank).toEqual({ matchday: 8, available: 1 });
    expect(r.transfer).toEqual({
      at: "2026-10-14T10:00:00.000Z",
      matchday: 8,
      out: 14,
      in: 101,
      priceOut: 4,
      priceIn: 4.3,
      free: true,
    });
    expect(r.captainChanged).toBe(false);
  });

  it("setzt einen Bankspieler auf denselben Bankplatz", () => {
    const r = applyTransfer(state, 7, 102, ctx);
    expect(r.ok && r.state.lineup!.bench.b).toEqual([102, 12, 15]);
  });

  it("macht beim Verkauf des Kapitäns den teuersten Starter zum Kapitän", () => {
    const pricey = new Map(players);
    pricey.set(9, { ...squadPlayers[8]!, price: 6.0 });
    const r = applyTransfer(state, 13, 103, { ...ctx, players: pricey });
    expect(r.ok && r.state.lineup!.captain).toBe(9);
    expect(r.ok && r.captainChanged).toBe(true);
  });

  it("verbraucht in Pausen und vor dem ersten Spieltag keine freien Transfers", () => {
    const r1 = applyTransfer(state, 14, 101, {
      ...ctx,
      window: { ...openWindow, isBreak: true },
    });
    expect(r1.ok && r1.state.transferBank.available).toBe(2);
    const r2 = applyTransfer({ ...state, firstMatchday: 8 }, 14, 101, ctx);
    expect(r2.ok && r2.transfer.free).toBe(true);
    expect(r2.ok && r2.state.transferBank.available).toBe(2);
  });

  it("braucht für unbegrenzte Transfers keine fortgeschriebene Bank", () => {
    // Wertung ab Spieltag 8, Fenster zu Spieltag 5: Bank steht noch auf 8.
    const early = {
      ...state,
      firstMatchday: 8,
      transferBank: { matchday: 8, available: 2 },
    };
    const r = applyTransfer(early, 14, 101, {
      ...ctx,
      window: { ...openWindow, matchday: 5 },
    });
    expect(r.ok && r.transfer).toMatchObject({ matchday: 5, free: true });
    expect(r.ok && r.state.transferBank).toEqual({ matchday: 8, available: 2 });
  });

  it("markiert Transfers ohne freies Kontingent als kostenpflichtig", () => {
    const r = applyTransfer(
      { ...state, transferBank: { matchday: 8, available: 0 } },
      14,
      101,
      ctx,
    );
    expect(r.ok && r.transfer.free).toBe(false);
  });

  it.each<[string, TransferState, number, number, Partial<typeof ctx>]>([
    ["window-closed", state, 14, 101, { window: { open: false } as never }],
    [
      "bank-stale",
      { ...state, transferBank: { matchday: 7, available: 2 } },
      14,
      101,
      {},
    ],
    ["no-squad", { ...state, lineup: null }, 14, 101, {}],
    ["not-in-squad", state, 99, 101, {}],
    ["already-in-squad", state, 14, 13, {}],
    ["unknown-player", state, 14, 999, {}],
    ["position", state, 14, 102, {}],
    ["not-purchasable", state, 14, 104, {}],
    ["not-purchasable", state, 14, 105, {}],
    ["cash", state, 14, 106, {}],
  ])("weist ab: %s", (expected, s, out, inId, over) => {
    expect(code(applyTransfer(s, out, inId, { ...ctx, ...over }))).toBe(
      expected,
    );
  });

  it("weist den 6. Spieler eines Vereins ab, erlaubt aber den Tausch innerhalb des Vereins", () => {
    const fiveOf100 = new Map(players);
    for (const id of [4, 5])
      fiveOf100.set(id, { ...squadPlayers[id - 1]!, teamId: 100 });
    // Verein 100 hat jetzt 1, 2, 3, 4, 5. Ein Stürmer von Verein 100 für Spieler 14 wäre der 6.
    expect(
      code(applyTransfer(state, 14, 103, { ...ctx, players: fiveOf100 })),
    ).toBe("club-limit");
    // Abwehrspieler 4 (Verein 100) gegen einen Abwehrspieler von Verein 100: bleibt bei 5.
    fiveOf100.set(107, {
      id: 107,
      position: "DEF",
      teamId: 100,
      price: 1,
      purchasable: true,
      active: true,
    });
    expect(
      code(applyTransfer(state, 4, 107, { ...ctx, players: fiveOf100 })),
    ).toBe("ok");
  });

  it("H: Manager kauft am Spieltag 5 Spieler, verfügbar 3 → 2 × −5 = −10 auf den Spieltag", () => {
    const newcomers: TransferPlayer[] = [201, 202, 203, 204, 205].map(
      (id, i) => ({
        id,
        position: positionOf([13, 14, 15, 3, 4][i]!),
        teamId: 300 + i,
        price: 4,
        purchasable: true,
        active: true,
      }),
    );
    const all = new Map([...squadPlayers, ...newcomers].map((p) => [p.id, p]));
    let s: TransferState = {
      ...state,
      transferBank: { matchday: 8, available: 3 },
    };
    for (const [out, inId] of [
      [13, 201],
      [14, 202],
      [15, 203],
      [3, 204],
      [4, 205],
    ] as const) {
      const r = applyTransfer(s, out, inId, { ...ctx, players: all });
      if (!r.ok) throw new Error(r.violations[0]!.message);
      s = r.state;
    }
    expect(s.transfers.map((t) => t.free)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    const pos = new Map([
      ...positions,
      ...newcomers.map((p) => [p.id, p.position] as const),
    ]);
    const score = scoreManager(8, s.lineup!, {}, s.transfers, pos);
    expect(score.transferPenalty).toBe(10);
    expect(score.total).toBe(-10);
  });
});

describe("cashAfterTransfer", () => {
  it("rechnet exakt in Zehnteln", () => {
    expect(cashAfterTransfer(0.3, 0.1, 0.2)).toBe(0.2);
    expect(cashAfterTransfer(1.1, 2.2, 3.3)).toBe(0);
  });
  it("wird negativ, wenn das Guthaben nicht reicht", () => {
    expect(cashAfterTransfer(0.5, 4.0, 4.6)).toBe(-0.1);
  });
});
