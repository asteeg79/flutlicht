import type { Position } from "@fm/core";

/** Kurzbezeichnung der Positionen in der App (TW, ABW, MF, ST). */
export const POS_LABEL: Record<Position, string> = {
  GK: "TW",
  DEF: "ABW",
  MID: "MF",
  FWD: "ST",
};
