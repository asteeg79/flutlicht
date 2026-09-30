// Welche Spieler sind beim Tauschen gültige Partner des gewählten? Das entscheidet
// core/swapPlayers (auch über Positionen hinweg, wenn die Formation erlaubt bleibt).
import {
  lineupPlayers,
  swapPlayers,
  type Lineup,
  type Position,
} from "@fm/core";

export function swapPartners(
  lineup: Lineup,
  selected: number,
  positionOf: (id: number) => Position | undefined,
  isLocked: (id: number) => boolean,
): Set<number> {
  return new Set(
    lineupPlayers(lineup).filter((id) => {
      if (id === selected || isLocked(id)) return false;
      const change = swapPlayers(lineup, selected, id, positionOf);
      return change.ok && change.lineup !== lineup;
    }),
  );
}
