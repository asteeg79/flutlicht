// Aufstellung und Sperren (KONZEPT 2.3–2.5).
import { POSITIONS, type Formation, type Position } from "./config/rules";
import type { Player } from "./schemas/data";
import type { Lineup } from "./schemas/manager";
import type { Violation } from "./violations";

/** "4-4-2" → { GK: 1, DEF: 4, MID: 4, FWD: 2 } */
export function formationCounts(
  formation: Formation,
): Record<Position, number> {
  const [def, mid, fwd] = formation.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { GK: 1, DEF: def, MID: mid, FWD: fwd };
}

/** Alle 15 Spieler der Aufstellung: Starter, Ersatz-TW, B1–B3. */
export function lineupPlayers(lineup: Lineup): number[] {
  return [...lineup.starters, lineup.bench.gk, ...lineup.bench.b];
}

/** Prüft Formation, Bank und Kapitän gegen den Kader (2.3, 2.4). */
export function validateLineup(
  lineup: Lineup,
  squad: readonly Pick<Player, "id" | "position">[],
): Violation[] {
  const violations: Violation[] = [];
  const positions = new Map(squad.map((p) => [p.id, p.position]));
  const all = lineupPlayers(lineup);
  if (
    new Set(all).size !== all.length ||
    all.length !== squad.length ||
    all.some((id) => !positions.has(id))
  ) {
    return [
      {
        code: "lineup-players",
        message:
          "Die Aufstellung muss genau die Spieler deines Kaders enthalten.",
      },
    ];
  }
  const need = formationCounts(lineup.formation);
  const starterPositions = lineup.starters.map((id) => positions.get(id));
  if (
    POSITIONS.some(
      (pos) => starterPositions.filter((p) => p === pos).length !== need[pos],
    )
  ) {
    violations.push({
      code: "formation",
      message: `Die Startelf passt nicht zur Formation ${lineup.formation}.`,
    });
  }
  if (positions.get(lineup.bench.gk) !== "GK") {
    violations.push({
      code: "bench-gk",
      message: "Auf der Ersatz-Torwart-Position muss ein Torwart stehen.",
    });
  }
  if (!lineup.starters.includes(lineup.captain)) {
    violations.push({
      code: "captain",
      message: "Der Kapitän muss in der Startelf stehen.",
    });
  }
  return violations;
}

/** Rolle eines Spielers: Startelf, Ersatz-TW oder Bankplatz B1–B3. */
function roleOf(lineup: Lineup, id: number): string | null {
  if (lineup.starters.includes(id)) return "starter";
  if (lineup.bench.gk === id) return "bench-gk";
  const b = lineup.bench.b.indexOf(id);
  return b >= 0 ? `B${b + 1}` : null;
}

/**
 * Prüft, dass gesperrte Spieler ihre Rolle und ihren Kapitänsstatus behalten (2.5).
 * Ein Formationswechsel ist damit erlaubt, solange nur ungesperrte Spieler die Rolle wechseln.
 */
export function diffLineupRespectsLocks(
  before: Lineup,
  after: Lineup,
  locked: ReadonlySet<number>,
): Violation[] {
  const violations: Violation[] = [];
  for (const id of locked) {
    if (roleOf(before, id) !== roleOf(after, id)) {
      violations.push({
        code: "locked-role",
        message:
          "Dieser Spieler ist gesperrt und kann nicht mehr ein- oder ausgewechselt werden.",
        playerId: id,
      });
    }
    if ((before.captain === id) !== (after.captain === id)) {
      violations.push({
        code: "locked-captain",
        message:
          "Der Kapitän kann nicht mehr gewechselt werden, weil ein beteiligter Spieler gesperrt ist.",
        playerId: id,
      });
    }
  }
  return violations;
}

/**
 * Aufstellung direkt nach dem Erstkader, damit es immer eine gültige gibt (2.3):
 * 4-4-2 mit den jeweils teuersten Spielern, Bank nach Preis absteigend,
 * Kapitän ist der teuerste Starter. Erwartet einen gültigen Kader (2/5/5/3).
 */
export function defaultLineup(
  squad: readonly Pick<Player, "id" | "position" | "price">[],
): Lineup {
  const byPrice = [...squad].sort((a, b) => b.price - a.price || a.id - b.id);
  const of = (pos: Position) =>
    byPrice.filter((p) => p.position === pos).map((p) => p.id);
  const [gk, def, mid, fwd] = [of("GK"), of("DEF"), of("MID"), of("FWD")];
  const starters = [
    gk[0]!,
    ...def.slice(0, 4),
    ...mid.slice(0, 4),
    ...fwd.slice(0, 2),
  ];
  const benchField = [def[4]!, mid[4]!, fwd[2]!];
  const price = new Map(squad.map((p) => [p.id, p.price]));
  benchField.sort((a, b) => price.get(b)! - price.get(a)! || a - b);
  const captain = starters.reduce((best, id) =>
    price.get(id)! > price.get(best)! ? id : best,
  );
  return {
    formation: "4-4-2",
    starters,
    bench: { gk: gk[1]!, b: benchField as [number, number, number] },
    captain,
  };
}
