// Transfer-Chips in der Tafel des Markts (Arena 5 „Transfers“): gemachte freie ✓,
// bezahlte −5, noch freie „Frei“, ohne freie zusätzlich gestrichelt „+ −5“.
// Zählung und Abzug stammen aus core (transferQuote, RULES.extraTransferPenalty).
import { RULES, type Transfer, type TransferQuote } from "@fm/core";

export type ChipKind = "used" | "paid" | "free" | "next";
export interface Chip {
  kind: ChipKind;
  label: string;
}

export interface TransferBoard {
  chips: Chip[];
  big: string;
  unit: string;
  /** Kurztext im Label: „danach −5 P. je Transfer“, „bisher −10 P. Abzug“. */
  note: string;
  tone: "free" | "penalty" | "off";
}

const minus = (n: number) => `−${n}`;

export function transferBoard(
  quote: TransferQuote | null,
  transfers: readonly Pick<Transfer, "matchday" | "free">[],
  window:
    | { open: false; reopensAfter: number | null }
    | { open: true; matchday: number },
): TransferBoard {
  if (!window.open || !quote)
    return {
      chips: [],
      big: "Zu",
      unit: "",
      note:
        window.open || window.reopensAfter === null
          ? "gerade zu"
          : `öffnet nach Spieltag ${window.reopensAfter}`,
      tone: "off",
    };
  if (quote.unlimited)
    return {
      chips: [],
      big: "∞",
      unit: "unbegrenzt",
      note: "ohne Abzug",
      tone: "free",
    };

  const penalty = RULES.extraTransferPenalty;
  const now = transfers.filter((t) => t.matchday === window.matchday);
  const used = now.filter((t) => t.free).length;
  const paid = now.length - used;
  const free = quote.freeLeft;
  const chips: Chip[] = [
    ...Array.from({ length: used }, (): Chip => ({ kind: "used", label: "✓" })),
    ...Array.from({ length: paid }, (): Chip => ({
      kind: "paid",
      label: minus(penalty),
    })),
    ...Array.from({ length: free }, (): Chip => ({
      kind: "free",
      label: "Frei",
    })),
    ...(free === 0
      ? [{ kind: "next", label: `+ ${minus(penalty)}` } as Chip]
      : []),
  ];
  if (free > 0)
    return {
      chips,
      big: String(free),
      unit: "frei",
      note: `danach ${minus(penalty)} P. je Transfer`,
      tone: "free",
    };
  if (paid > 0)
    return {
      chips,
      big: minus(paid * penalty),
      unit: "P.",
      note: `bisher ${minus(paid * penalty)} P. Abzug`,
      tone: "penalty",
    };
  return {
    chips,
    big: "0",
    unit: "frei",
    note: `jeder weitere ${minus(penalty)} P.`,
    tone: "penalty",
  };
}
