import { describe, expect, it } from "vitest";
import {
  finalizedAt,
  lockAt,
  matchdayCalendar,
  type CalendarFixture,
} from "../src";

const game = (
  matchday: number,
  kickoffUtc: string,
  over: Partial<CalendarFixture> = {},
): CalendarFixture => ({
  matchday,
  kickoffUtc,
  homeTeamId: 1,
  awayTeamId: 2,
  status: "scheduled",
  ...over,
});
const finalsUntil = (md: number, lastAt: string) =>
  new Map(
    Array.from({ length: md }, (_, i) => [
      i + 1,
      new Date(i + 1 === md ? lastAt : "2026-08-01T07:00:00Z"),
    ]),
  );

describe("aktueller Spieltag (KONZEPT 2.1)", () => {
  it("ist der kleinste nicht finale Spieltag, null nach dem 34.", () => {
    expect(matchdayCalendar([], new Map()).current).toBe(1);
    expect(
      matchdayCalendar([], finalsUntil(7, "2026-10-12T07:00:00Z")).current,
    ).toBe(8);
    expect(
      matchdayCalendar([], finalsUntil(34, "2027-05-24T07:00:00Z")).current,
    ).toBeNull();
  });

  it("Finalisierung = Stand der finalen Punkte, vorläufige zählen nicht", () => {
    const finals = finalizedAt([
      { matchday: 1, status: "final", generatedAt: "2026-08-24T07:00:00Z" },
      {
        matchday: 2,
        status: "provisional",
        generatedAt: "2026-08-31T07:00:00Z",
      },
    ]);
    expect(finals).toEqual(new Map([[1, new Date("2026-08-24T07:00:00Z")]]));
    expect(matchdayCalendar([], finals).current).toBe(2);
  });
});

describe("Sperren (KONZEPT 2.5)", () => {
  const fixtures = [
    game(5, "2026-10-03T13:30:00Z", { homeTeamId: 100, awayTeamId: 101 }),
    game(5, "2026-10-02T18:30:00Z", { homeTeamId: 102, awayTeamId: 103 }),
  ];
  const cal = matchdayCalendar(
    fixtures,
    finalsUntil(4, "2026-09-28T07:00:00Z"),
  );
  const locked = (teamId: number, now: string) =>
    cal.lockedPlayers([{ id: 1, teamId }], new Date(now)).has(1);

  it("sperrt 90 Minuten vor Anpfiff", () => {
    expect(lockAt(fixtures[0]!).toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });

  it("findet die früheste Sperre des Spieltags", () => {
    expect(cal.firstLock(5)?.toISOString()).toBe("2026-10-02T17:00:00.000Z");
    expect(cal.firstLock(6)).toBeNull();
  });

  it("ist vor der Sperrzeit offen und ab der Sperrzeit gesperrt", () => {
    expect(locked(101, "2026-10-03T11:59:59Z")).toBe(false);
    expect(locked(101, "2026-10-03T12:00:00Z")).toBe(true);
  });

  it("sperrt jeden Spieler nach seinem eigenen Spiel", () => {
    expect(locked(102, "2026-10-02T20:00:00Z")).toBe(true);
    expect(locked(100, "2026-10-02T20:00:00Z")).toBe(false);
  });

  it("sperrt Spieler ohne Spiel am Spieltag nicht", () => {
    expect(locked(999, "2026-12-01T00:00:00Z")).toBe(false);
  });

  it("prüft auf Wunsch einen anderen Spieltag als den aktuellen", () => {
    const later = matchdayCalendar(
      fixtures,
      finalsUntil(5, "2026-10-05T07:00:00Z"),
    );
    const players = [{ id: 1, teamId: 101 }];
    expect(
      later.lockedPlayers(players, new Date("2026-10-04T00:00:00Z")).size,
    ).toBe(0);
    expect(
      later.lockedPlayers(players, new Date("2026-10-04T00:00:00Z"), 5).has(1),
    ).toBe(true);
  });

  it("begonnen ist ein Spieltag ab seiner ersten Sperre oder ohne Spiele", () => {
    expect(cal.started(5, new Date("2026-10-02T16:59:00Z"))).toBe(false);
    expect(cal.started(5, new Date("2026-10-02T17:00:00Z"))).toBe(true);
    expect(cal.started(6, new Date("2026-09-01T00:00:00Z"))).toBe(true);
  });
});

describe("Transferfenster (KONZEPT 2.6)", () => {
  const fixtures = [
    game(8, "2026-10-17T13:30:00Z"),
    game(8, "2026-10-18T15:30:00Z"),
    game(9, "2026-10-24T13:30:00Z"),
  ];
  const finals = finalsUntil(7, "2026-10-12T07:00:00Z");

  it("ist zwischen Finalisierung und erster Sperre offen", () => {
    expect(
      matchdayCalendar(fixtures, finals).transferWindow(
        new Date("2026-10-14T10:00:00Z"),
      ),
    ).toEqual({
      open: true,
      matchday: 8,
      closesAt: new Date("2026-10-17T12:00:00Z"),
      isBreak: false,
    });
  });

  it("ist ab der ersten Sperre geschlossen", () => {
    expect(
      matchdayCalendar(fixtures, finals).transferWindow(
        new Date("2026-10-17T12:00:00Z"),
      ),
    ).toEqual({ open: false });
  });

  it("erkennt eine Pause ab 10 Tagen", () => {
    const cal = matchdayCalendar(
      fixtures,
      finalsUntil(7, "2026-10-07T12:00:00Z"),
    );
    expect(cal.transferWindow(new Date("2026-10-10T00:00:00Z"))).toMatchObject({
      open: true,
      isBreak: true,
    });
    expect(cal.isBreak(8)).toBe(true);
    const short = matchdayCalendar(
      fixtures,
      finalsUntil(7, "2026-10-07T12:00:01Z"),
    );
    expect(short.isBreak(8)).toBe(false);
  });

  it("zählt den Saisonstart als Pause", () => {
    const cal = matchdayCalendar([game(1, "2026-08-28T18:30:00Z")], new Map());
    expect(cal.transferWindow(new Date("2026-08-01T00:00:00Z"))).toMatchObject({
      open: true,
      matchday: 1,
      isBreak: true,
    });
  });

  it("ist geschlossen, wenn die Saison vorbei ist oder Spiele fehlen", () => {
    expect(
      matchdayCalendar(
        fixtures,
        finalsUntil(34, "2027-05-24T07:00:00Z"),
      ).transferWindow(new Date()),
    ).toEqual({ open: false });
    expect(
      matchdayCalendar([], finals).transferWindow(
        new Date("2026-10-14T10:00:00Z"),
      ),
    ).toEqual({ open: false });
  });
});

describe("erster Spieltag eines neuen Managers", () => {
  const cal = (finals: Map<number, Date>) =>
    matchdayCalendar(
      [game(5, "2026-10-09T18:30:00Z"), game(6, "2026-10-16T18:30:00Z")],
      finals,
    );
  const finals = finalsUntil(4, "2026-09-22T07:00:00Z");

  it("nimmt den aktuellen Spieltag vor seiner ersten Sperre, danach den nächsten", () => {
    expect(
      cal(finals).firstMatchdayFor(new Date("2026-10-09T16:59:00Z"), 1),
    ).toBe(5);
    expect(
      cal(finals).firstMatchdayFor(new Date("2026-10-09T17:00:00Z"), 1),
    ).toBe(6);
  });

  it("startet nie vor dem ersten gewerteten Spieltag und nie nach dem 34.", () => {
    expect(
      cal(finals).firstMatchdayFor(new Date("2026-09-25T10:00:00Z"), 8),
    ).toBe(8);
    expect(
      cal(finalsUntil(34, "2027-05-24T07:00:00Z")).firstMatchdayFor(
        new Date(),
        1,
      ),
    ).toBe(34);
  });
});

describe("nächste Sperre (App-Rahmen)", () => {
  const cal = matchdayCalendar(
    [
      game(4, "2026-10-02T18:30:00Z"),
      game(5, "2026-10-09T18:30:00Z"),
      game(5, "2026-10-10T13:30:00Z"),
      game(5, "2026-10-10T16:30:00Z", { status: "postponed" }),
    ],
    finalsUntil(4, "2026-10-05T07:00:00Z"),
  );

  it("vor dem Spieltag: erste Sperre 90 Min. vor dem ersten Anpfiff", () => {
    const lock = cal.nextLock(new Date("2026-10-01T00:00:00Z"));
    expect(lock?.at.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(lock?.running).toBe(false);
  });

  it("während des Spieltags: die nächste noch offene Sperre, verlegte zählen nicht", () => {
    const lock = cal.nextLock(new Date("2026-10-09T20:00:00Z"));
    expect(lock?.at.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(lock?.running).toBe(true);
    expect(cal.nextLock(new Date("2026-10-10T12:00:00Z"))).toBeNull();
  });
});
