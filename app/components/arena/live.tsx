"use client";

import { SCORING } from "@fm/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CountUp } from "@/components/arena/count-up";
import {
  liveEvents,
  parseSnapshot,
  snapshotKey,
  toSnapshot,
  type LiveSlot,
  type LiveSnapshot,
} from "@/components/arena/live-diff";

// Einmal je Seitenaufruf gelesen: der Stand vom letzten Besuch.
const seen = new Map<number, LiveSnapshot | null>();
function readSeen(matchday: number): LiveSnapshot | null {
  if (!seen.has(matchday)) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(snapshotKey(matchday));
    } catch {
      // Privater Modus: dann eben ohne Vergleich.
    }
    seen.set(matchday, parseSnapshot(raw));
  }
  return seen.get(matchday) ?? null;
}
const noSubscribe = () => () => {};

function usePrevious(matchday: number): LiveSnapshot | null {
  return useSyncExternalStore(
    noSubscribe,
    () => readSeen(matchday),
    () => null,
  );
}

/** Live-Punkte: rollen vom letzten gesehenen Stand zur neuen Zahl und merken sich den Stand. */
export function LiveTotal({
  matchday,
  total,
  slots,
}: {
  matchday: number;
  total: number;
  slots: LiveSlot[];
}) {
  const prev = usePrevious(matchday);
  useEffect(() => {
    try {
      localStorage.setItem(
        snapshotKey(matchday),
        JSON.stringify(toSnapshot(total, slots)),
      );
    } catch {
      // siehe oben
    }
  }, [matchday, total, slots]);
  return (
    <Rolling
      key={prev?.total ?? "neu"}
      from={prev?.total ?? total}
      to={total}
    />
  );
}

function Rolling({ from, to }: { from: number; to: number }) {
  const [shown, setShown] = useState(from);
  useEffect(() => {
    const timer = setTimeout(() => setShown(to), 250);
    return () => clearTimeout(timer);
  }, [to]);
  return <CountUp value={shown} ms={900} flash />;
}

/** Gelbes Ereignis-Banner bei neuen Punkten eigener Spieler seit dem letzten Besuch. */
export function LiveBanner({
  matchday,
  slots,
}: {
  matchday: number;
  slots: LiveSlot[];
}) {
  const events = liveEvents(usePrevious(matchday), slots);
  if (events.length === 0) return null;
  const [top, ...rest] = events;
  return (
    <div
      role="status"
      data-testid="live-banner"
      className="arena-anim mt-2 flex animate-[arena-pop_.6s_cubic-bezier(.2,1.3,.4,1)_both] items-center gap-2.5 bg-lampe px-3 py-2 font-display text-[22px] leading-none font-black text-nacht uppercase"
    >
      <span className="truncate">Neue Punkte! {top!.name}</span>
      {rest.length > 0 ? (
        <span className="shrink-0 text-sm">+{rest.length} weitere</span>
      ) : null}
      <span className="ml-auto shrink-0">
        +{top!.delta}
        {top!.captain ? ` ×${SCORING.captainMultiplier}` : ""}
      </span>
    </div>
  );
}
