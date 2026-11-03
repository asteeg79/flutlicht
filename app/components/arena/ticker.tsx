import { mioNumber } from "@/lib/format";

export interface TickerItem {
  id: number;
  lastName: string;
  /** Preisänderung seit dem letzten Spieltag in Mio. */
  delta: number;
}

/**
 * Kurs-Laufband (Arena 5 „Kurs-Ticker“): 28 s je Durchlauf, die Liste steht zweimal
 * hintereinander, damit die Schleife nahtlos ist.
 */
export function Ticker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const entry = (t: TickerItem, copy: number) => (
    <span
      key={`${copy}-${t.id}`}
      aria-hidden={copy === 1}
      className="flex items-baseline gap-1.5 font-display text-base font-extrabold tracking-[0.03em] uppercase"
    >
      {t.lastName}{" "}
      <span className={t.delta > 0 ? "text-tick-up" : "text-tick-down"}>
        {t.delta > 0 ? "▲" : "▼"} {mioNumber(Math.abs(t.delta))}
      </span>
    </span>
  );
  return (
    <div
      aria-label="Kursänderungen seit dem letzten Spieltag"
      role="marquee"
      className="flex h-[34px] items-center overflow-hidden bg-ticker-bg text-ticker-text"
    >
      <div className="arena-anim flex animate-[arena-ticker_28s_linear_infinite] gap-[26px] pl-[18px] whitespace-nowrap">
        {items.map((t) => entry(t, 0))}
        {items.map((t) => entry(t, 1))}
      </div>
    </div>
  );
}
