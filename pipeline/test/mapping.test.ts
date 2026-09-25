import { describe, expect, it } from "vitest";
import {
  lastNameOf,
  mapPlayer,
  swapDayMonth,
  type TmCandidate,
} from "../src/steps/mapping";

const cand = (
  tmId: string,
  name: string,
  birthDate: string,
  tmClubId?: string,
): TmCandidate => ({
  tmId,
  name,
  lastName: name.split(" ").at(-1)!,
  birthDate,
  tmClubId,
});

const index = (list: TmCandidate[]) => {
  const m = new Map<string, TmCandidate[]>();
  for (const c of list)
    m.set(c.birthDate!, [...(m.get(c.birthDate!) ?? []), c]);
  return m;
};

const subject = {
  playerId: 1,
  name: "Leopold Querfeld",
  lastName: "Querfeld",
  birthDate: "2003-12-20",
  teamId: 2547,
  tmClubId: "89",
};

describe("mapPlayer (KONZEPT 5.4)", () => {
  it("Stufe 1: Name + Geburtsdatum + Verein, auch wenn der Spieler in beiden Quellen steht", () => {
    const idx = index([
      cand("100", "Leopold Querfeld", "2003-12-20", "89"),
      cand("100", "Leopold Querfeld", "2003-12-20", "89"),
    ]);
    expect(mapPlayer(subject, idx, undefined)).toEqual({ tmId: "100" });
  });

  it("Stufe 2: Nachname + Geburtsdatum bei Vereinswechsel und anderer Schreibweise", () => {
    const idx = index([cand("100", "L. Querfeld", "2003-12-20", "40")]);
    expect(mapPlayer(subject, idx, undefined)).toEqual({ tmId: "100" });
  });

  it("meldet mehrere Treffer als ambiguous", () => {
    const idx = index([
      cand("100", "Max Querfeld", "2003-12-20"),
      cand("200", "Tim Querfeld", "2003-12-20"),
    ]);
    const r = mapPlayer(subject, idx, undefined);
    expect(r.tmId).toBeNull();
    expect(r.tmId === null && r.review?.reason).toBe("ambiguous");
  });

  it("meldet gleiches Geburtsdatum mit anderem Namen als unmatched, samt Kandidaten", () => {
    const r = mapPlayer(
      subject,
      index([cand("300", "Someone Else", "2003-12-20", "89")]),
      undefined,
    );
    expect(r.tmId === null && r.review).toMatchObject({
      reason: "unmatched",
      candidates: [{ tmId: "300", tmClubId: "89" }],
    });
  });

  it("meldet fehlende Kandidaten als not-found", () => {
    const r = mapPlayer(subject, new Map(), undefined);
    expect(r.tmId === null && r.review).toMatchObject({
      reason: "not-found",
      candidates: [],
    });
  });

  it("folgt der Admin-Zuordnung, auch der bewussten Nicht-Zuordnung", () => {
    expect(mapPlayer(subject, new Map(), "999")).toEqual({ tmId: "999" });
    expect(
      mapPlayer(
        subject,
        index([cand("100", "Leopold Querfeld", "2003-12-20", "89")]),
        null,
      ),
    ).toEqual({ tmId: null, review: null });
  });

  it("ordnet über leere Namensschlüssel nichts zu", () => {
    const r = mapPlayer(
      { ...subject, name: "李", lastName: "李" },
      index([cand("1", "A B", "2003-12-20")]),
      undefined,
    );
    expect(r.tmId).toBeNull();
  });
});

describe("Eigenheiten der Quellen", () => {
  it("findet den Spieler auch mit vertauschtem Tag und Monat", () => {
    const idx = index([cand("100", "Leopold Querfeld", "2003-12-20", "89")]);
    expect(
      mapPlayer({ ...subject, birthDate: "2003-20-12" }, idx, undefined),
    ).toEqual({ tmId: "100" });
    const fuellkrug = {
      ...subject,
      name: "Niclas Füllkrug",
      lastName: "Füllkrug",
      birthDate: "1993-02-09",
      tmClubId: "79",
    };
    expect(
      mapPlayer(
        fuellkrug,
        index([cand("7", "Niclas Füllkrug", "1993-09-02", "79")]),
        undefined,
      ),
    ).toEqual({ tmId: "7" });
  });

  it("findet Namen in umgekehrter Reihenfolge", () => {
    const hwang = {
      ...subject,
      name: "Hwang Hee-chan",
      lastName: "Hee-chan",
      birthDate: "1996-01-26",
      tmClubId: "33",
    };
    expect(
      mapPlayer(
        hwang,
        index([cand("9", "Hee-chan Hwang", "1996-01-26", "33")]),
        undefined,
      ),
    ).toEqual({ tmId: "9" });
  });

  it("vertauscht nur, wenn der Tag ≤ 12 ist und sich vom Monat unterscheidet", () => {
    expect(swapDayMonth("1993-02-09")).toBe("1993-09-02");
    expect(swapDayMonth("1996-01-26")).toBeNull();
    expect(swapDayMonth("2000-05-05")).toBeNull();
  });
});

describe("lastNameOf", () => {
  it("nimmt das letzte Wort, wenn Sofascore keinen Nachnamen liefert", () => {
    expect(lastNameOf("Marin Ljubičić", "")).toBe("Ljubičić");
    expect(lastNameOf("Zeno Van Den Bosch", "Van Den Bosch")).toBe(
      "Van Den Bosch",
    );
  });
});
