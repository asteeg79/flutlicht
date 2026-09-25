import { describe, expect, it } from "vitest";
import {
  findInvite,
  findReset,
  firstMatchdayFor,
  League,
  normalizeCode,
} from "../src";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const league: League = {
  invites: [
    { code: "ABCD2345", createdAt: "2026-09-25T10:00:00Z" },
    {
      code: "USED2345",
      createdAt: "2026-09-25T10:00:00Z",
      usedBy: U1,
      usedAt: "2026-09-25T11:00:00Z",
    },
    { code: "GONE2345", createdAt: "2026-09-25T10:00:00Z", revoked: true },
  ],
  resets: [
    { code: "RSET2345", userId: U1, createdAt: "2026-09-25T10:00:00Z" },
    {
      code: "DONE2345",
      userId: U1,
      createdAt: "2026-09-25T10:00:00Z",
      usedAt: "2026-09-25T10:05:00Z",
    },
  ],
};

describe("Codes (KONZEPT 8.3)", () => {
  it("prüft das Code-Format", () => {
    expect(
      League.safeParse({
        invites: [{ code: "ABCD2345", createdAt: "2026-09-25T10:00:00Z" }],
        resets: [],
      }).success,
    ).toBe(true);
    expect(
      League.safeParse({
        invites: [{ code: "ABCD1O45", createdAt: "2026-09-25T10:00:00Z" }],
        resets: [],
      }).success,
    ).toBe(false);
  });

  it("findet nur unbenutzte, nicht widerrufene Einladungen, unabhängig von Schreibweise", () => {
    expect(normalizeCode(" abcd 2345 ")).toBe("ABCD2345");
    expect(findInvite(league, "abcd2345")?.code).toBe("ABCD2345");
    expect(findInvite(league, "USED2345")).toBeUndefined();
    expect(findInvite(league, "GONE2345")).toBeUndefined();
    expect(findInvite(league, "NOPE2345")).toBeUndefined();
  });

  it("akzeptiert Reset-Codes nur für den eigenen Manager, einmalig und 24 h lang", () => {
    const within = new Date("2026-09-26T09:59:59Z");
    expect(findReset(league, "RSET2345", U1, within)?.code).toBe("RSET2345");
    expect(findReset(league, "RSET2345", U2, within)).toBeUndefined();
    expect(
      findReset(league, "RSET2345", U1, new Date("2026-09-26T10:00:00Z")),
    ).toBeUndefined();
    expect(findReset(league, "DONE2345", U1, within)).toBeUndefined();
  });
});

describe("firstMatchdayFor", () => {
  const fixtures = [
    { matchday: 5, kickoffUtc: "2026-10-09T18:30:00Z" },
    { matchday: 6, kickoffUtc: "2026-10-16T18:30:00Z" },
  ];
  const finals = new Map(
    [1, 2, 3, 4].map((md) => [md, new Date("2026-09-22T07:00:00Z")]),
  );

  it("nimmt den aktuellen Spieltag vor seiner ersten Sperre, danach den nächsten", () => {
    expect(
      firstMatchdayFor(fixtures, finals, new Date("2026-10-09T16:59:00Z"), 1),
    ).toBe(5);
    expect(
      firstMatchdayFor(fixtures, finals, new Date("2026-10-09T17:00:00Z"), 1),
    ).toBe(6);
  });
  it("startet nie vor dem ersten gewerteten Spieltag und nie nach dem 34.", () => {
    expect(
      firstMatchdayFor(fixtures, finals, new Date("2026-09-25T10:00:00Z"), 8),
    ).toBe(8);
    const allFinal = new Map(
      Array.from({ length: 34 }, (_, i) => [i + 1, new Date()]),
    );
    expect(firstMatchdayFor(fixtures, allFinal, new Date(), 1)).toBe(34);
  });
});
