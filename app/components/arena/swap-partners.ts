// Welche Spieler sind beim Tauschen gültige Partner des gewählten? Das entscheidet
// core/swapPlayers (auch über Positionen hinweg, wenn die Formation erlaubt bleibt,
// und mit den Sperren aus 2.5).
import {
  lineupPlayers,
  swapPlayers,
  type Lineup,
  type Position,
} from "@fm/core";

export function swapPartners(
  lineup: Lineup,
  selected: number,
  squad: {
    positionOf: (id: number) => Position | undefined;
    isLocked: (id: number) => boolean;
  },
): Set<number> {
  return new Set(
    lineupPlayers(lineup).filter((id) => {
      if (id === selected) return false;
      const change = swapPlayers(lineup, selected, id, squad);
      return change.ok && change.lineup !== lineup;
    }),
  );
}
