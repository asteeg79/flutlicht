import { describe, expect, it } from "vitest";
import {
  applyInitialSquad,
  matchdayCalendar,
  moveToSeasonStart,
  newManagerState,
  seasonChangeViolation,
  tradeBlocker,
  type CalendarFixture,
} from "../src";
import { SQUAD_IDS, squadPlayers } from "./helpers";

const game = (matchday: number, kickoffUtc: string): CalendarFixture => ({
  matchday,
  kickoffUtc,
  homeTeamId: 1,
  awayTeamId: 2,
  status: "scheduled",
});
// Spieltage 1–7 final, Spieltag 8 sperrt am 30.10. 18:00 UTC, Spieltag 9 am 06.11.
const calendar = matchdayCalendar(
  [game(8, "2026-10-30T19:30:00Z"), game(9, "2026-11-06T19:30:00Z")],
  new Map(
    [1, 2, 3, 4, 5, 6, 7].map((md) => [md, new Date("2026-10-26T07:00:00Z")]),
  ),
);
const BEFORE_8 = new Date("2026-10-28T12:00:00Z");
const AFTER_8 = new Date("2026-10-31T12:00:00Z");

describe("neuer Manager (KONZEPT 2.2, 2.6)", () => {
  it("startet ohne Kader mit Startbudget und frischer Transferbank", () => {
    expect(newManagerState(8, 85)).toEqual({
      firstMatchday: 8,
      squad: [],
      cash: 85,
      lineup: null,
      lineupHistory: {},
      transfers: [],
      transferBank: { matchday: 8, available: 2 },
    });
  });

  it("Saisonstart verschieben: erster Spieltag und Transferbank ziehen mit", () => {
    const doc = { ...newManagerState(8, 85), cash: 3 };
    expect(moveToSeasonStart(doc, 9)).toEqual({
      ...doc,
      firstMatchday: 9,
      transferBank: { matchday: 9, available: 2 },
    });
  });
});

describe("Erstkader (KONZEPT 2.2, 2.7)", () => {
  const ctx = (now: Date) => ({
    players: squadPlayers,
    calendar,
    now,
    startBudget: 85,
    firstScoredMatchday: 8,
  });

  it("setzt Kader, Kaufpreise, Guthaben, Standard-Aufstellung und Transferbank", () => {
    const result = applyInitialSquad(
      newManagerState(8, 85),
      SQUAD_IDS,
      ctx(BEFORE_8),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.squad).toEqual(SQUAD_IDS);
    expect(result.state.cash).toBe(25);
    expect(result.state.initialPrices?.[1]).toBe(4);
    expect(result.state.lineup?.formation).toBe("4-4-2");
    expect(result.state.firstMatchday).toBe(8);
    expect(result.state.transferBank).toEqual({ matchday: 8, available: 2 });
  });

  it("nach der ersten Sperre des Startspieltags startet der Manager später, nie früher", () => {
    const late = applyInitialSquad(
      newManagerState(8, 85),
      SQUAD_IDS,
      ctx(AFTER_8),
    );
    expect(late.ok && late.state.firstMatchday).toBe(9);
    const already9 = applyInitialSquad(
      newManagerState(9, 85),
      SQUAD_IDS,
      ctx(BEFORE_8),
    );
    expect(already9.ok && already9.state.firstMatchday).toBe(9);
  });

  it("weist einen zweiten Erstkader, unbekannte Spieler und ungültige Kader ab", () => {
    const first = applyInitialSquad(
      newManagerState(8, 85),
      SQUAD_IDS,
      ctx(BEFORE_8),
    );
    if (!first.ok) throw new Error("Erstkader erwartet");
    const codes = (r: ReturnType<typeof applyInitialSquad>) =>
      r.ok ? [] : r.violations.map((v) => v.code);
    expect(
      codes(applyInitialSquad(first.state, SQUAD_IDS, ctx(BEFORE_8))),
    ).toEqual(["squad-exists"]);
    expect(
      codes(
        applyInitialSquad(
          newManagerState(8, 85),
          [...SQUAD_IDS.slice(1), 999],
          ctx(BEFORE_8),
        ),
      ),
    ).toEqual(["unknown-player"]);
    expect(
      codes(
        applyInitialSquad(newManagerState(8, 85), SQUAD_IDS, {
          ...ctx(BEFORE_8),
          startBudget: 50,
        }),
      ),
    ).toContain("budget");
  });
});

describe("Saisonstart ändern (KONZEPT 11)", () => {
  it("geht nur vor der ersten Sperre des ersten gewerteten Spieltags", () => {
    expect(seasonChangeViolation(calendar, 8, 9, BEFORE_8)).toBeNull();
    expect(seasonChangeViolation(calendar, 8, 9, AFTER_8)?.code).toBe(
      "season-started",
    );
  });

  it("der neue Startspieltag darf weder vor dem aktuellen liegen noch begonnen haben", () => {
    expect(seasonChangeViolation(calendar, 8, 5, BEFORE_8)?.code).toBe(
      "matchday-started",
    );
    expect(seasonChangeViolation(calendar, 9, 8, AFTER_8)?.code).toBe(
      "matchday-started",
    );
  });
});

describe("tradeBlocker (Markt und Server prüfen dasselbe)", () => {
  const window = calendar.transferWindow(BEFORE_8);

  it("blockiert bei geschlossenem Fenster und bei nicht fortgeschriebener Bank", () => {
    expect(
      tradeBlocker(
        { transferBank: { matchday: 8, available: 2 }, firstMatchday: 5 },
        { open: false },
      )?.code,
    ).toBe("window-closed");
    expect(
      tradeBlocker(
        { transferBank: { matchday: 7, available: 2 }, firstMatchday: 5 },
        window,
      )?.code,
    ).toBe("bank-stale");
    expect(
      tradeBlocker(
        { transferBank: { matchday: 8, available: 2 }, firstMatchday: 5 },
        window,
      ),
    ).toBeNull();
  });

  it("vor dem ersten gewerteten Spieltag braucht es keine fortgeschriebene Bank", () => {
    expect(
      tradeBlocker(
        { transferBank: { matchday: 7, available: 2 }, firstMatchday: 8 },
        window,
      ),
    ).toBeNull();
  });
});
