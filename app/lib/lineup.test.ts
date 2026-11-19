import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCaptain, swapPlayers, type Lineup } from "@fm/core";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-lineup-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

const { updateLineup } = await import("@/lib/lineup");
const { finalsUntil, players, UPDATED, withSquad } =
  await import("@/test/fixtures");

/**
 * Spieltag 9 mit fester Uhr: Verein 1–2 Fr. 20:30 (Sperre 19:00 Berlin = 18:00 UTC),
 * Verein 3–4 Sa. 15:30 (Sperre 14:00 Berlin). Vereine 5 und 6 spielen nicht.
 * Standardaufstellung des Test-Kaders: TW 1 (Verein 1), ABW 11–14, MF 21–24,
 * ST 31, 32; Bank: TW 2, B1–B3 = 33, 25, 15 (nach Preis; 15 ist Verein 1); Kapitän 31 (Verein 2).
 */
const fixtures = [
  { home: 1, away: 2, kickoffUtc: "2026-11-06T19:30:00Z" },
  { home: 3, away: 4, kickoffUtc: "2026-11-07T14:30:00Z" },
].map((f, i) => ({
  matchday: 9,
  openligaMatchId: i,
  homeTeamId: f.home,
  awayTeamId: f.away,
  kickoffUtc: f.kickoffUtc,
  originalKickoffUtc: f.kickoffUtc,
  status: "scheduled" as const,
  dataState: "none" as const,
}));
const FRIDAY_EVENING = "2026-11-06T20:00:00Z"; // Verein 1 und 2 gesperrt
const ctx = (now: string) => ({
  now: new Date(now),
  players,
  fixtures,
  finals: finalsUntil(8, "2026-11-02T07:00:00Z"),
  startBudget: 85,
  firstScoredMatchday: 8,
});

const positionOf = (id: number) => players.find((p) => p.id === id)?.position;
function swapped(l: Lineup, a: number, b: number): Lineup {
  const r = swapPlayers(l, a, b, { positionOf, isLocked: () => false });
  if (!r.ok) throw new Error(r.message);
  return r.lineup;
}
const put = async (
  lineup: Lineup,
  now = FRIDAY_EVENING,
  updatedAt = UPDATED,
) => {
  const doc = await withSquad();
  return updateLineup(doc.userId, { lineup, updatedAt }, ctx(now));
};
const base = async () => (await withSquad()).lineup!;

describe("PUT /api/lineup mit Sperren (KONZEPT 2.5, Abnahme M7)", () => {
  it("weist den Tausch mit einem gesperrten Spieler ab, mit deutscher Meldung", async () => {
    // ABW 15 (Bank, Verein 1: gesperrt) für ABW 11 (Verein 3: noch offen)
    const lineup = swapped(await base(), 11, 15);
    await expect(put(lineup)).rejects.toMatchObject({
      status: 400,
      message:
        "Spieler 15: Dieser Spieler ist gesperrt und kann nicht mehr ein- oder ausgewechselt werden.",
    });
  });

  it("erlaubt den Tausch zweier ungesperrter Spieler am laufenden Spieltag", async () => {
    // MF 22 (Verein 3, Sperre erst Samstag) gegen MF 25 (Verein 6, kein Spiel)
    const lineup = swapped(await base(), 22, 25);
    const m = await put(lineup);
    expect(m.lineup!.starters).toContain(25);
    expect(m.lineup!.bench.b).toEqual([33, 22, 15]);
    expect(m.updatedAt).toBe("2026-11-06T20:00:00.000Z");
  });

  it("weist den Kapitänswechsel bei gesperrtem Alt-Kapitän ab", async () => {
    const r = setCaptain(await base(), 32, { isLocked: () => false });
    if (!r.ok) throw new Error(r.message);
    await expect(put(r.lineup)).rejects.toMatchObject({
      status: 400,
      message:
        "Spieler 31: Der Kapitän kann nicht mehr gewechselt werden, weil ein beteiligter Spieler gesperrt ist.",
    });
  });

  it("macht keinen gesperrten Spieler zum neuen Kapitän", async () => {
    const doc = await withSquad();
    const start = setCaptain(doc.lineup!, 32, { isLocked: () => false });
    if (!start.ok) throw new Error(start.message);
    await withSquad(undefined, { lineup: start.lineup });
    const r = setCaptain(start.lineup, 21, { isLocked: () => false }); // Verein 2: gesperrt
    if (!r.ok) throw new Error(r.message);
    await expect(
      updateLineup(
        doc.userId,
        { lineup: r.lineup, updatedAt: UPDATED },
        ctx(FRIDAY_EVENING),
      ),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("erlaubt einen Formationswechsel, wenn nur ungesperrte Spieler die Rolle wechseln", async () => {
    // ABW 12 (Verein 4) raus, ST 33 (Verein 4) rein → 3-4-3
    const lineup = swapped(await base(), 12, 33);
    expect((await put(lineup)).lineup!.formation).toBe("3-4-3");
  });

  it("erlaubt vor der ersten Sperre jede gültige Änderung", async () => {
    const lineup = swapped(await base(), 11, 15);
    expect(
      (await put(lineup, "2026-11-06T17:59:00Z")).lineup!.starters,
    ).toContain(15);
  });
});

describe("PUT /api/lineup: Gültigkeit", () => {
  it("weist eine ungültige Aufstellung ab", async () => {
    const l = await base();
    const invalid: Lineup = { ...l, formation: "3-4-3" };
    await expect(put(invalid, "2026-11-01T12:00:00Z")).rejects.toMatchObject({
      status: 400,
      message: "Die Startelf passt nicht zur Formation 3-4-3.",
    });
  });

  it("antwortet mit 409 auf einen veralteten Stand", async () => {
    await expect(
      put(await base(), FRIDAY_EVENING, "2026-09-30T10:00:00.000Z"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("verlangt zuerst einen Erstkader", async () => {
    const lineup = await base();
    const { saveDoc } = await import("@/test/fixtures");
    const doc = await saveDoc(); // gleicher Manager, jetzt ohne Kader
    await expect(
      updateLineup(
        doc.userId,
        { lineup, updatedAt: UPDATED },
        ctx(FRIDAY_EVENING),
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Stelle zuerst deinen Erstkader auf.",
    });
  });
});
