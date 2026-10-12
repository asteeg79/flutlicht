import { describe, expect, it } from "vitest";
import {
  playerMatchPoints,
  ratingPoints,
  scoreManager,
  type Lineup,
  type PlayerMatchInput,
} from "../src";
import { lineup442, positions, pts } from "./helpers";

const quiet: Omit<
  PlayerMatchInput,
  "position" | "minutes" | "started" | "rating" | "teamConceded"
> = {
  goals: 0,
  assists: 0,
  ownGoals: 0,
  yellow: false,
  yellowRed: false,
  red: false,
  penMissed: 0,
  penSaved: 0,
};

/** Wertet einen einzelnen Spieler als Starter in der 4-4-2-Aufstellung. */
function scoreSingle(id: number, input: PlayerMatchInput, captain: number) {
  const result = playerMatchPoints(input);
  const lineup: Lineup = { ...lineup442, captain };
  const score = scoreManager(7, lineup, { [id]: result }, [], positions);
  return { result, score, slot: score.slots.find((s) => s.starterId === id)! };
}

describe("Rechenbeispiele KONZEPT 3.5", () => {
  const a: PlayerMatchInput = {
    ...quiet,
    position: "FWD",
    minutes: 90,
    started: true,
    rating: 7.8,
    goals: 1,
    assists: 1,
    yellow: true,
    teamConceded: 1,
  };

  it("A: ST, Startelf (Manager + real), 90′, Note 7.8, 1 Tor, 1 Vorlage, Gelb → 6.5 + 5 + 4 − 1 = 14.5 → 15; +2 Bonus = 17", () => {
    const { result, slot, score } = scoreSingle(13, a, 14);
    expect(result.parts).toMatchObject({
      rating: 6.5,
      goals: 5,
      assists: 4,
      cards: -1,
    });
    expect(result.base).toBe(15);
    expect(slot.points).toBe(17);
    expect(score.total).toBe(17);
  });

  it("A′: wie A, als Kapitän → 17 × 2 = 34", () => {
    const { score } = scoreSingle(13, a, 13);
    expect(score.captainBonus).toBe(17);
    expect(score.total).toBe(34);
  });

  it("B: ABW, eingewechselt, 30′, Note 6.9, Team zu null → 2 × 30/60 = 1; zu null erst ab 60′ → 0; gesamt 1", () => {
    const { result, slot } = scoreSingle(
      3,
      {
        ...quiet,
        position: "DEF",
        minutes: 30,
        started: false,
        rating: 6.9,
        teamConceded: 0,
      },
      13,
    );
    expect(result.parts.rating).toBe(1);
    expect(result.parts.cleanSheet).toBe(0);
    expect(slot.points).toBe(1);
  });

  it("C: TW, Startelf, 90′, Note 6.1, 3 Gegentore, 1 Elfer gehalten → −2 − 2 + 6 = 2; +2 Bonus = 4", () => {
    const { result, slot } = scoreSingle(
      1,
      {
        ...quiet,
        position: "GK",
        minutes: 90,
        started: true,
        rating: 6.1,
        teamConceded: 3,
        penSaved: 1,
      },
      13,
    );
    expect(result.parts).toMatchObject({
      rating: -2,
      conceded: -2,
      penSaved: 6,
    });
    expect(result.base).toBe(2);
    expect(slot.points).toBe(4);
  });

  it("D: MF 0′ (Starter beim Manager) → Auto-Wechsel: B1 = MF mit 90′, Note 7.0 → 2.5 → 3 (kein Bonus)", () => {
    const b1 = playerMatchPoints({
      ...quiet,
      position: "MID",
      minutes: 90,
      started: true,
      rating: 7.0,
      teamConceded: 1,
    });
    expect(b1.base).toBe(3);
    const lineup: Lineup = { ...lineup442, bench: { gk: 2, b: [12, 7, 15] } };
    const score = scoreManager(
      7,
      lineup,
      { 8: pts(0, 0), 12: b1 },
      [],
      positions,
    );
    const slot = score.slots.find((s) => s.starterId === 8)!;
    expect(slot).toMatchObject({
      playerId: 12,
      subbedIn: true,
      startBonus: 0,
      points: 3,
    });
  });

  it("E: Kapitän 0′, Bankspieler rückt nach (7 P.) → keine Verdopplung → 7", () => {
    const score = scoreManager(
      7,
      lineup442,
      { 13: pts(0, 0), 15: pts(7) },
      [],
      positions,
    );
    const slot = score.slots.find((s) => s.starterId === 13)!;
    expect(slot).toMatchObject({ playerId: 15, points: 7 });
    expect(score.captainBonus).toBe(0);
    expect(score.total).toBe(7);
  });

  it("F: ABW, 75′, Note 6.4, keine Ereignisse, Team 2 Gegentore, Startelf → −0.5 − 1 = −1.5 → −2; +2 Bonus = 0", () => {
    const { result, slot } = scoreSingle(
      3,
      {
        ...quiet,
        position: "DEF",
        minutes: 75,
        started: true,
        rating: 6.4,
        teamConceded: 2,
      },
      13,
    );
    expect(result.parts.rating).toBe(-0.5);
    expect(result.parts.conceded).toBe(-1);
    expect(result.base).toBe(-2);
    expect(slot.points).toBe(0);
  });

  const g: PlayerMatchInput = {
    ...quiet,
    position: "FWD",
    minutes: 90,
    started: true,
    rating: 5.9,
    red: true,
    teamConceded: 0,
  };

  it("G: ST, Startelf, 90′, Note 5.9, Rot → −3 − 5 = −8; +2 = −6", () => {
    const { result, score } = scoreSingle(13, g, 14);
    expect(result.base).toBe(-8);
    expect(score.total).toBe(-6);
  });

  it("G als Kapitän → −12", () => {
    const { score } = scoreSingle(13, g, 13);
    expect(score.total).toBe(-12);
  });
});

describe("playerMatchPoints", () => {
  const base: PlayerMatchInput = {
    ...quiet,
    position: "MID",
    minutes: 90,
    started: true,
    rating: 6.5,
    teamConceded: 1,
  };

  it("gibt bei 0 Minuten 0 Punkte, auch mit Karte auf der Bank", () => {
    const r = playerMatchPoints({ ...base, minutes: 0, red: true, rating: 8 });
    expect(r.base).toBe(0);
    expect(Object.values(r.parts).every((v) => v === 0)).toBe(true);
  });

  it("wertet eine fehlende Note mit 0", () => {
    expect(
      playerMatchPoints({ ...base, rating: null, minutes: 5 }).parts.rating,
    ).toBe(0);
  });

  it("zählt Gelb und danach Gelb-Rot nur als −3", () => {
    expect(
      playerMatchPoints({ ...base, yellow: true, yellowRed: true }).parts.cards,
    ).toBe(-3);
  });

  it("addiert Gelb und glatt Rot", () => {
    expect(
      playerMatchPoints({ ...base, yellow: true, red: true }).parts.cards,
    ).toBe(-6);
  });

  it("wertet Eigentor und verschossenen Elfmeter mit je −3", () => {
    const r = playerMatchPoints({ ...base, ownGoals: 1, penMissed: 1 });
    expect(r.parts.ownGoals).toBe(-3);
    expect(r.parts.penMissed).toBe(-3);
    expect(r.base).toBe(-6);
  });

  it("gibt zu null ab 60 Minuten je nach Position", () => {
    const cs = (position: PlayerMatchInput["position"]) =>
      playerMatchPoints({ ...base, position, minutes: 60, teamConceded: 0 })
        .parts.cleanSheet;
    expect([cs("GK"), cs("DEF"), cs("MID"), cs("FWD")]).toEqual([5, 4, 1, 0]);
  });

  it("zählt Gegentore erst ab dem zweiten und nie −0", () => {
    const r = playerMatchPoints({ ...base, position: "DEF", teamConceded: 1 });
    expect(Object.is(r.parts.conceded, 0)).toBe(true);
    expect(
      playerMatchPoints({ ...base, position: "GK", teamConceded: 4 }).parts
        .conceded,
    ).toBe(-3);
  });

  it("gibt Toren je nach Position unterschiedlich viele Punkte", () => {
    const goal = (position: PlayerMatchInput["position"]) =>
      playerMatchPoints({ ...base, position, goals: 1, teamConceded: 1 }).parts
        .goals;
    expect([goal("GK"), goal("DEF"), goal("MID"), goal("FWD")]).toEqual([
      8, 7, 6, 5,
    ]);
  });
});

describe("scoreManager: Auto-Wechsel, Kapitän, Transferabzug", () => {
  it("ersetzt einen TW nur durch den Ersatz-TW", () => {
    const score = scoreManager(
      7,
      lineup442,
      { 2: pts(4), 7: pts(9) },
      [],
      positions,
    );
    expect(score.slots[0]).toMatchObject({
      starterId: 1,
      playerId: 2,
      points: 4,
    });
  });

  it("lässt jeden Bankspieler höchstens einmal nachrücken", () => {
    const score = scoreManager(7, lineup442, { 7: pts(3) }, [], positions);
    const subs = score.slots.filter((s) => s.subbedIn);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ starterId: 3, playerId: 7 });
  });

  it("überspringt Bankspieler ohne Einsatz und lässt sonst 0 Punkte", () => {
    const lineup: Lineup = { ...lineup442, bench: { gk: 2, b: [12, 7, 15] } };
    const score = scoreManager(7, lineup, { 12: pts(0, 0) }, [], positions);
    expect(score.slots.find((s) => s.starterId === 8)).toMatchObject({
      playerId: null,
      points: 0,
    });
  });

  it("durchsucht die Bank in der Reihenfolge B1→B3", () => {
    const lineup: Lineup = {
      formation: "3-5-2",
      starters: [1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14],
      bench: { gk: 2, b: [6, 15, 7] },
      captain: 13,
    };
    const score = scoreManager(
      7,
      lineup,
      { 6: pts(2), 7: pts(8) },
      [],
      positions,
    );
    expect(score.slots.find((s) => s.starterId === 3)).toMatchObject({
      playerId: 6,
    });
    expect(score.slots.find((s) => s.starterId === 4)).toMatchObject({
      playerId: 7,
    });
  });

  it("gibt den Startelf-Bonus nur bei realer Startelf", () => {
    const score = scoreManager(
      7,
      lineup442,
      { 3: pts(4, 30, false) },
      [],
      positions,
    );
    expect(score.slots[1]).toMatchObject({ startBonus: 0, points: 4 });
  });

  it("zieht nur bezahlte Transfers dieses Spieltags ab", () => {
    const transfers = [
      { matchday: 7, free: false },
      { matchday: 7, free: true },
      { matchday: 6, free: false },
    ];
    const score = scoreManager(7, lineup442, {}, transfers, positions);
    expect(score.transferPenalty).toBe(5);
    expect(score.total).toBe(-5);
  });
});

describe("ratingPoints (3.1, Beispiel im Spielerprofil)", () => {
  it("Note 7,4: +4,5 ab 60 Minuten, anteilig darunter, ohne Note 0", () => {
    expect(ratingPoints(7.4, 90)).toBe(4.5);
    expect(ratingPoints(7.4, 30)).toBe(2.25);
    expect(ratingPoints(6.0, 60)).toBe(-2.5);
    expect(ratingPoints(null, 90)).toBe(0);
  });
});
