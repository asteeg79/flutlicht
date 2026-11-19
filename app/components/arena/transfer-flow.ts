// Ablauf eines Transfers im Markt (KONZEPT 2.6): zwei Wege zum selben Bestätigen.
// „Holen zuerst“: Neuzugang gewählt, jetzt die Abgabe. „Abgeben zuerst“: Abgabe
// gewählt, jetzt der Neuzugang. Ob ein Tausch erlaubt ist, entscheidet core.

export type TransferFlow =
  | { step: "idle" }
  /** Holen zuerst: `buyId` steht, die Abgabe wird gewählt. */
  | { step: "pick"; buyId: number }
  /** Abgeben zuerst: `sellId` steht, der Neuzugang wird gewählt. */
  | { step: "sell"; sellId: number }
  /** Beide stehen; `from` sagt, wohin „Zurück“ führt. */
  | { step: "confirm"; sellId: number; buyId: number; from: "pick" | "sell" };

export type FlowAction =
  | { type: "pick"; id: number }
  | { type: "sell"; id: number }
  /** Den fehlenden Spieler wählen: die Abgabe (nach pick) oder den Neuzugang (nach sell). */
  | { type: "choose"; id: number }
  | { type: "back" }
  | { type: "cancel" };

export const IDLE: TransferFlow = { step: "idle" };

export function transferFlow(
  flow: TransferFlow,
  action: FlowAction,
): TransferFlow {
  switch (action.type) {
    case "pick":
      return { step: "pick", buyId: action.id };
    case "sell":
      return { step: "sell", sellId: action.id };
    case "choose":
      if (flow.step === "pick")
        return {
          step: "confirm",
          sellId: action.id,
          buyId: flow.buyId,
          from: "pick",
        };
      if (flow.step === "sell")
        return {
          step: "confirm",
          sellId: flow.sellId,
          buyId: action.id,
          from: "sell",
        };
      return flow;
    case "back":
      if (flow.step !== "confirm") return flow;
      return flow.from === "pick"
        ? { step: "pick", buyId: flow.buyId }
        : { step: "sell", sellId: flow.sellId };
    case "cancel":
      return IDLE;
  }
}

/** Die einzelnen Rollen, wie die Ansicht sie braucht (null = noch nicht gewählt). */
export function flowIds(flow: TransferFlow): {
  pickId: number | null;
  sellId: number | null;
  buyId: number | null;
  fromPick: boolean;
} {
  return {
    pickId: flow.step === "pick" ? flow.buyId : null,
    sellId:
      flow.step === "sell" || flow.step === "confirm" ? flow.sellId : null,
    buyId: flow.step === "confirm" ? flow.buyId : null,
    fromPick: flow.step === "confirm" && flow.from === "pick",
  };
}
