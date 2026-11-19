import { describe, expect, it } from "vitest";
import { flowIds, IDLE, transferFlow, type FlowAction } from "./transfer-flow";

const run = (...actions: FlowAction[]) => actions.reduce(transferFlow, IDLE);

describe("transferFlow: Ablauf eines Transfers im Markt", () => {
  it("Holen zuerst: Neuzugang, dann Abgabe, dann bestätigen", () => {
    const flow = run({ type: "pick", id: 10 }, { type: "choose", id: 3 });
    expect(flow).toEqual({
      step: "confirm",
      sellId: 3,
      buyId: 10,
      from: "pick",
    });
    expect(flowIds(flow)).toEqual({
      pickId: null,
      sellId: 3,
      buyId: 10,
      fromPick: true,
    });
  });

  it("Abgeben zuerst: Abgabe, dann Neuzugang, dann bestätigen", () => {
    const flow = run({ type: "sell", id: 3 }, { type: "choose", id: 10 });
    expect(flow).toEqual({
      step: "confirm",
      sellId: 3,
      buyId: 10,
      from: "sell",
    });
    expect(flowIds(flow).fromPick).toBe(false);
  });

  it("Zurück aus dem Bestätigen führt auf den Weg, über den man kam", () => {
    expect(
      run(
        { type: "pick", id: 10 },
        { type: "choose", id: 3 },
        { type: "back" },
      ),
    ).toEqual({ step: "pick", buyId: 10 });
    expect(
      run(
        { type: "sell", id: 3 },
        { type: "choose", id: 10 },
        { type: "back" },
      ),
    ).toEqual({ step: "sell", sellId: 3 });
  });

  it("Abbrechen, und ein neuer Start ersetzt den alten Weg", () => {
    expect(run({ type: "pick", id: 10 }, { type: "cancel" })).toEqual(IDLE);
    expect(run({ type: "pick", id: 10 }, { type: "sell", id: 3 })).toEqual({
      step: "sell",
      sellId: 3,
    });
  });

  it("Wählen oder Zurück ohne passenden Schritt ändert nichts", () => {
    expect(run({ type: "choose", id: 3 })).toEqual(IDLE);
    expect(run({ type: "back" })).toEqual(IDLE);
    expect(run({ type: "pick", id: 10 }, { type: "back" })).toEqual({
      step: "pick",
      buyId: 10,
    });
  });

  it("die Rollen für die Ansicht", () => {
    expect(flowIds(IDLE)).toEqual({
      pickId: null,
      sellId: null,
      buyId: null,
      fromPick: false,
    });
    expect(flowIds(run({ type: "pick", id: 10 })).pickId).toBe(10);
    expect(flowIds(run({ type: "sell", id: 3 })).sellId).toBe(3);
  });
});
