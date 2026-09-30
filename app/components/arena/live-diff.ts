// Live-Spieltag (Arena 6): neue Punkte erkennen, indem der letzte gesehene Datenstand
// (localStorage) mit dem aktuellen verglichen wird. Neue Daten kommen als neuer Build.

export interface LiveSnapshot {
  total: number;
  /** Starter-ID → Punkte des Slots (inkl. Kapitän ×2 nicht, der steht separat). */
  slots: Record<string, number>;
}

export interface LiveSlot {
  id: number;
  name: string;
  points: number;
  captain: boolean;
}

export interface LiveEvent {
  name: string;
  delta: number;
  captain: boolean;
}

export const snapshotKey = (matchday: number) => `flutlicht-live-${matchday}`;

export function parseSnapshot(raw: string | null): LiveSnapshot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as LiveSnapshot;
    return typeof s.total === "number" && s.slots ? s : null;
  } catch {
    return null;
  }
}

export function toSnapshot(
  total: number,
  slots: readonly LiveSlot[],
): LiveSnapshot {
  return {
    total,
    slots: Object.fromEntries(slots.map((s) => [s.id, s.points])),
  };
}

/** Slots mit mehr Punkten als beim letzten Besuch, größte Änderung zuerst. */
export function liveEvents(
  prev: LiveSnapshot | null,
  slots: readonly LiveSlot[],
): LiveEvent[] {
  if (!prev) return [];
  return slots
    .map((s) => ({
      name: s.name,
      delta: s.points - (prev.slots[s.id] ?? 0),
      captain: s.captain,
    }))
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta);
}
