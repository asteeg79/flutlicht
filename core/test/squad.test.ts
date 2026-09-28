import { describe, expect, it } from "vitest";
import {
  draftAddViolation,
  sumPrices,
  validateSquad,
  type SquadCandidate,
} from "../src";
import { squadPlayers } from "./helpers";

const codes = (players: readonly SquadCandidate[], budget = 65) =>
  validateSquad(players, budget).map((v) => v.code);

describe("validateSquad (KONZEPT 2.2, 2.7)", () => {
  it("akzeptiert einen gültigen Kader", () => {
    expect(validateSquad(squadPlayers, 65)).toEqual([]);
  });

  it("verlangt genau 15 verschiedene Spieler", () => {
    expect(codes(squadPlayers.slice(0, 14))).toContain("squad-size");
    expect(codes([...squadPlayers.slice(0, 14), squadPlayers[0]!])).toContain(
      "squad-size",
    );
  });

  it("verlangt 2 TW, 5 ABW, 5 MF, 3 ST", () => {
    const wrong = squadPlayers.map((p) =>
      p.id === 13 ? { ...p, position: "MID" as const } : p,
    );
    const v = validateSquad(wrong, 65);
    expect(v.map((x) => x.code)).toEqual([
      "squad-composition",
      "squad-composition",
    ]);
    expect(v[0]!.message).toBe(
      "Du brauchst genau 5 Mittelfeldspieler (aktuell 6).",
    );
  });

  it("weist einen 6. Spieler desselben Vereins ab", () => {
    const six = squadPlayers.map((p) =>
      p.id <= 6 ? { ...p, teamId: 100 } : p,
    );
    expect(codes(six)).toEqual(["club-limit"]);
  });

  it("erlaubt genau 5 Spieler eines Vereins", () => {
    const five = squadPlayers.map((p) =>
      p.id <= 5 ? { ...p, teamId: 100 } : p,
    );
    expect(codes(five)).toEqual([]);
  });

  it("weist nicht kaufbare und inaktive Spieler ab", () => {
    const bad = squadPlayers.map((p) =>
      p.id === 1
        ? { ...p, purchasable: false }
        : p.id === 2
          ? { ...p, active: false }
          : p,
    );
    const v = validateSquad(bad, 65);
    expect(v.map((x) => [x.code, x.playerId])).toEqual([
      ["not-purchasable", 1],
      ["not-purchasable", 2],
    ]);
  });

  it("weist einen Kader über dem Budget ab und akzeptiert genau das Budget", () => {
    const priced = squadPlayers.map((p) => ({ ...p, price: 4.3 }));
    expect(codes(priced, 64.5)).toEqual([]);
    const v = validateSquad(priced, 64.4);
    expect(v.map((x) => x.code)).toEqual(["budget"]);
    expect(v[0]!.message).toBe(
      "Der Kader ist zu teuer: 64,5 Mio. bei 64,4 Mio. Budget.",
    );
  });
});

describe("sumPrices", () => {
  it("summiert ohne Fließkomma-Reste", () => {
    expect(sumPrices([0.1, 0.2])).toBe(0.3);
  });
});

describe("draftAddViolation (Erstkader Schritt für Schritt)", () => {
  const draft = squadPlayers.slice(0, 14); // es fehlt ein Stürmer
  const striker: SquadCandidate = {
    id: 99,
    position: "FWD",
    teamId: 200,
    price: 4,
    purchasable: true,
    active: true,
  };
  const code = (p: SquadCandidate, budget = 65, d = draft) =>
    draftAddViolation(d, p, budget)?.code ?? null;

  it("lässt einen passenden Spieler zu, auch genau auf das Budget", () => {
    expect(code(striker)).toBeNull();
    expect(code({ ...striker, price: 9 }, 65)).toBeNull();
  });

  it("weist eine volle Position ab", () => {
    expect(code({ ...striker, position: "GK" })).toBe("squad-composition");
  });

  it("weist einen 6. Spieler desselben Vereins ab", () => {
    const five = draft.map((p) => (p.id <= 5 ? { ...p, teamId: 300 } : p));
    expect(code({ ...striker, teamId: 300 }, 65, five)).toBe("club-limit");
  });

  it("weist einen zu teuren und einen nicht kaufbaren Spieler ab", () => {
    expect(code({ ...striker, price: 9.1 })).toBe("budget");
    expect(code({ ...striker, purchasable: false })).toBe("not-purchasable");
    expect(code({ ...striker, active: false })).toBe("not-purchasable");
  });
});
