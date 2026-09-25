// Gemeinsame Testdaten: ein gültiger Kader (2 TW, 5 ABW, 5 MF, 3 ST) und eine 4-4-2-Aufstellung.
import type { Lineup, Position, TransferPlayer } from "../src";

/** IDs 1–2 TW, 3–7 ABW, 8–12 MF, 13–15 ST. */
export function positionOf(id: number): Position {
  if (id <= 2) return "GK";
  if (id <= 7) return "DEF";
  if (id <= 12) return "MID";
  return "FWD";
}

export const SQUAD_IDS = Array.from({ length: 15 }, (_, i) => i + 1);

/** Drei Spieler je Verein (Vereine 100–104), Preis 4.0. */
export const squadPlayers: TransferPlayer[] = SQUAD_IDS.map((id) => ({
  id,
  position: positionOf(id),
  teamId: 100 + Math.floor((id - 1) / 3),
  price: 4,
  purchasable: true,
  active: true,
}));

export const positions = new Map(SQUAD_IDS.map((id) => [id, positionOf(id)]));

export const lineup442: Lineup = {
  formation: "4-4-2",
  starters: [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14],
  bench: { gk: 2, b: [7, 12, 15] },
  captain: 13,
};

/** Punkte-Eintrag für scoreManager. */
export function pts(base: number, minutes = 90, started = true) {
  return { minutes, started, base };
}
