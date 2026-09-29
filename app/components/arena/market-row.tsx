import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PosBadge } from "@/components/arena/pos-badge";
import { ClubLogo } from "@/components/club-logo";
import { PlayerPhoto } from "@/components/player-photo";
import { mioNumber } from "@/lib/format";

export interface RowPlayer {
  id: number;
  name: string;
  image?: string;
  club: string;
  clubLogo: string;
  posLabel: string;
  price: number;
  points: number;
  form: number | null;
  /** Preisänderung seit dem letzten Spieltag (Mio.). */
  delta: number;
  inactive?: boolean;
}

const formText = (f: number | null) =>
  f === null
    ? "–"
    : f.toLocaleString("de-DE", { maximumFractionDigits: 1 }).replace("-", "−");

/** ▲/▼ Betrag in Up/Down-Farbe; ohne Änderung nichts. */
export function Trend({
  delta,
  className = "",
}: {
  delta: number;
  className?: string;
}) {
  if (delta === 0) return null;
  return (
    <span className={`${delta > 0 ? "text-up" : "text-down"} ${className}`}>
      {delta > 0 ? "▲" : "▼"}
      {mioNumber(Math.abs(delta))}
    </span>
  );
}

/** Listenzeile mobil (Arena 4 „MarketRow“): Foto mit Position, Name, Verein · Punkte · Form, Trend und Preis, Aktion. */
export function MarketRow({
  p,
  picked = false,
  action,
}: {
  p: RowPlayer;
  picked?: boolean;
  action?: ReactNode;
}) {
  return (
    <li
      data-testid="market-row"
      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-3 transition-colors duration-500 ease-out ${picked ? "bg-picked-row" : ""}`}
    >
      <span className="relative h-12 w-12">
        <PlayerPhoto src={p.image} className="h-12 w-12" />
        <PosBadge
          variant="list"
          label={p.posLabel}
          className="absolute -bottom-1 -left-1"
        />
      </span>
      <span className="min-w-0">
        <Link
          href={`/spieler/${p.id}`}
          className="block truncate font-display text-[21px] leading-none font-black uppercase hover:underline"
        >
          {p.name}
        </Link>
        <span className="mt-[3px] block truncate text-xs font-medium text-muted">
          {p.club} · {p.points} P. · Form {formText(p.form)}
          {p.inactive ? " · nicht mehr in der Liga" : ""}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-baseline gap-[5px]">
          <Trend
            delta={p.delta}
            className="font-display text-xs font-extrabold"
          />
          <span className="font-display text-[26px] leading-none font-black tabular-nums">
            {mioNumber(p.price)}
          </span>
        </span>
        {action}
      </span>
    </li>
  );
}

const COLS =
  "grid grid-cols-[40px_minmax(0,1fr)_104px_40px_40px_58px_60px_96px] items-center gap-2";

/** Tabelle auf dem Desktop (Arena 3.2 Markt): Foto · Name · Verein · Pkt · Form · Trend · Preis · Aktion. */
export function MarketTable({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  return (
    <div role="table" aria-label="Spielerliste">
      <div
        role="row"
        className={`${COLS} border-b-2 border-text px-2.5 pt-3.5 pb-2 font-display text-[13px] font-extrabold tracking-[0.08em] text-muted uppercase`}
      >
        <span role="columnheader" />
        <span role="columnheader" className="whitespace-nowrap">
          {count} Spieler
        </span>
        <span role="columnheader">Verein</span>
        <span role="columnheader" className="text-right">
          Pkt
        </span>
        <span role="columnheader" className="text-right">
          Form
        </span>
        <span role="columnheader" className="text-right">
          Trend
        </span>
        <span role="columnheader" className="text-right">
          Preis
        </span>
        <span role="columnheader" />
      </div>
      <div role="rowgroup">{children}</div>
    </div>
  );
}

export function MarketTableRow({
  p,
  picked = false,
  action,
}: {
  p: RowPlayer;
  picked?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      role="row"
      data-testid="market-row"
      className={`${COLS} border-b border-line px-2.5 py-2 hover:bg-text/[0.04] ${picked ? "bg-picked-row" : ""}`}
    >
      <span role="cell" className="relative h-10 w-10">
        <PlayerPhoto src={p.image} className="h-10 w-10" />
        <PosBadge
          variant="list"
          label={p.posLabel}
          className="absolute -right-1.5 -bottom-[3px] text-[11px] leading-3"
        />
      </span>
      <span role="cell" className="min-w-0">
        <Link
          href={`/spieler/${p.id}`}
          className="block truncate font-display text-xl leading-none font-black uppercase hover:underline"
        >
          {p.name}
        </Link>
      </span>
      <span
        role="cell"
        className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-muted"
      >
        <ClubLogo src={p.clubLogo} className="h-[18px] w-[18px]" />
        <span className="truncate">{p.club}</span>
      </span>
      <span
        role="cell"
        className="text-right font-display text-lg font-extrabold"
      >
        {p.points}
      </span>
      <span
        role="cell"
        className="text-right font-display text-lg font-extrabold text-muted"
      >
        {formText(p.form)}
      </span>
      <span
        role="cell"
        className="text-right font-display text-[15px] font-extrabold"
      >
        <Trend delta={p.delta} />
      </span>
      <span
        role="cell"
        className="text-right font-display text-2xl leading-none font-black tabular-nums"
      >
        {mioNumber(p.price)}
      </span>
      <span role="cell" className="flex justify-end">
        {action}
      </span>
    </div>
  );
}

/** Gelber Holen-Knopf (auch „Abgeben“ im Holen-Sheet). */
export function PrimaryAction({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`slant h-11 bg-lampe px-3.5 font-display text-base font-black text-nacht uppercase disabled:opacity-50 lg:h-[34px] lg:text-[17px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Umrandeter Knopf („Raus“, „Abgeben“ im Kader). */
export function OutlineAction({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`h-11 border-2 border-text px-3 font-display text-base font-black uppercase disabled:border-line disabled:text-muted lg:h-[34px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Sperrgrund, antippbar (gestrichelt rot): erklärt per Toast, warum es nicht geht. */
export function ReasonAction({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="min-h-11 max-w-[124px] border-[1.5px] border-dashed border-down px-2.5 text-[11px] leading-tight font-semibold text-down lg:min-h-[34px]"
      {...props}
    >
      {children}
    </button>
  );
}

export function OwnedTag() {
  return (
    <span className="border-[1.5px] border-muted px-1.5 py-0.5 font-display text-xs font-extrabold tracking-[0.06em] text-muted uppercase">
      Im Kader
    </span>
  );
}

/** Fenster zu: statt Holen ein grauer Rahmen mit Schloss. */
export function ClosedTag() {
  return (
    <span className="flex h-8 items-center gap-[5px] border-2 border-line px-3 font-display text-[15px] font-black text-muted uppercase">
      <Lock aria-hidden className="h-[11px] w-[11px]" strokeWidth={3} />
      Zu
    </span>
  );
}
