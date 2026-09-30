import { describe, expect, it } from "vitest";
import {
  liveEvents,
  parseSnapshot,
  toSnapshot,
} from "@/components/arena/live-diff";

const slots = [
  { id: 1, name: "Kane", points: 11, captain: true },
  { id: 2, name: "Díaz", points: 3, captain: false },
  { id: 3, name: "Tah", points: 4, captain: false },
];

describe("Live-Differenz", () => {
  it("erkennt neue Punkte seit dem letzten Datenstand", () => {
    const prev = { total: 10, slots: { "1": 6, "2": 3, "3": 1 } };
    expect(liveEvents(prev, slots)).toEqual([
      { name: "Kane", delta: 5, captain: true },
      { name: "Tah", delta: 3, captain: false },
    ]);
  });

  it("beim ersten Besuch keine Ereignisse", () => {
    expect(liveEvents(null, slots)).toEqual([]);
  });

  it("Snapshot hin und zurück, kaputte Werte zählen als keiner", () => {
    const snap = toSnapshot(18, slots);
    expect(parseSnapshot(JSON.stringify(snap))).toEqual(snap);
    expect(parseSnapshot("{kaputt")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ total: "x" }))).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });
});
