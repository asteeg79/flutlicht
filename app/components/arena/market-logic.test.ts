import { describe, expect, it } from "vitest";
import {
  draftExplanation,
  hotPlayers,
  missingCash,
  shortReason,
  sorter,
  tickerPlayers,
} from "@/components/arena/market-logic";

const p = (id: number, delta: number, price = 5) => ({
  id,
  position: "MID" as const,
  teamId: 1,
  price,
  delta,
});

describe("Markt-Logik", () => {
  it("Kurzformen der Sperrgründe", () => {
    expect(
      shortReason({ code: "club-limit", message: "" }, { club: "Bayern" }),
    ).toBe("schon 5 von Bayern");
    expect(shortReason({ code: "cash", message: "" }, { missing: 1.2 })).toBe(
      "fehlen 1,2 Mio",
    );
    expect(shortReason({ code: "squad-composition", message: "" }, {})).toBe(
      "Position voll",
    );
    expect(shortReason({ code: "window-closed", message: "Zu." }, {})).toBe(
      "Zu.",
    );
  });

  it("Fehlbetrag ohne Fließkomma-Reste", () => {
    expect(missingCash(0.3, 5.1, 6.6)).toBe(1.2);
  });

  it("Erklärungen im Erstkader", () => {
    const kane = {
      shortName: "H. Kane",
      position: "FWD" as const,
      price: 10.8,
    };
    expect(
      draftExplanation({ code: "budget", message: "" }, kane, {
        remaining: 7.6,
      }),
    ).toBe("H. Kane kostet 10,8 Mio – du hast noch 7,6 Mio.");
    expect(
      draftExplanation({ code: "squad-composition", message: "" }, kane, {
        remaining: 0,
      }),
    ).toBe("Stürmer ist voll – nimm erst einen raus.");
    expect(
      draftExplanation({ code: "club-limit", message: "" }, kane, {
        club: "Bayern",
        remaining: 0,
      }),
    ).toBe("Höchstens 5 Spieler von Bayern.");
  });

  it("Heiß gerade: nur Anstieg, nicht im Kader, höchstens 5", () => {
    const list = [
      p(1, 0.5),
      p(2, -0.3),
      p(3, 0.2),
      p(4, 0.6),
      p(5, 0.1),
      p(6, 0.1),
      p(7, 0.3),
      p(8, 0.4),
    ];
    expect(hotPlayers(list, new Set([4])).map((x) => x.id)).toEqual([
      1, 8, 7, 3, 5,
    ]);
  });

  it("Ticker nach Betrag, Auf- und Abstieg", () => {
    expect(
      tickerPlayers([p(1, 0.2), p(2, -0.5), p(3, 0)]).map((x) => x.id),
    ).toEqual([2, 1]);
  });

  it("Sortierung nach Form stellt Spieler ohne Einsatz ans Ende", () => {
    const stats = {
      1: { points: 3, form: 2 },
      2: { points: 9, form: null },
    } as never;
    expect(
      [p(2, 0), p(1, 0)].sort(sorter("form", stats)).map((x) => x.id),
    ).toEqual([1, 2]);
    expect(
      [p(1, 0), p(2, 0)].sort(sorter("points", stats)).map((x) => x.id),
    ).toEqual([2, 1]);
  });
});
