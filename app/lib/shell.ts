// Daten für den App-Rahmen (Seitenleiste, Countdown). Die nächste Sperre rechnet
// core (matchdayCalendar().nextLock); hier steht nur die Beschriftung.
import type { NextLock } from "@fm/core";

export function lockLabel(lock: Pick<NextLock, "running">): string {
  return lock.running ? "Nächste fixiert in" : "Fixiert in";
}
