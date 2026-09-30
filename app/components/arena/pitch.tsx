"use client";

import { Lock } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PosBadge, type PosState } from "@/components/arena/pos-badge";
import { PlayerPhoto } from "@/components/player-photo";

export type TokenAnim =
  | { kind: "swap-l" | "swap-r" | "shake"; key: number }
  | { kind: "pop"; key: number; delay: number };

function animClass(anim: TokenAnim | null | undefined): string {
  switch (anim?.kind) {
    case "swap-l":
      return "animate-[arena-swap0_.65s_cubic-bezier(.2,1.4,.4,1)_both]";
    case "swap-r":
      return "animate-[arena-swap1_.65s_cubic-bezier(.2,1.4,.4,1)_both]";
    case "shake":
      return "animate-[arena-shake_.45s_ease-in-out_both]";
    case "pop":
      return "animate-[arena-pop_.45s_cubic-bezier(.2,1.3,.4,1)_both]";
    default:
      return "";
  }
}

export interface TokenPlayer {
  lastName: string;
  image?: string;
  clubLogo: string;
  posLabel: string;
}

/** Punkte-Chip am Foto: ab 10 gelb, negativ rot, sonst dunkel. */
function pointsLook(points: number): string {
  if (points >= 10) return "bg-lampe text-nacht";
  return points < 0 ? "bg-karte-tief text-white" : "bg-plate-bg text-white";
}

/**
 * Spieler auf dem Feld (Arena 4 „PlayerToken“): Foto mit Ring, Logo, Positions-Badge,
 * Punkte-Chip, C-Marke, Namensschild (mit Schloss, wenn fixiert) und Unterzeile.
 * Fixierte Spieler bleiben farbig, nur das Schloss zeigt den Zustand.
 */
export function PlayerToken({
  player,
  points,
  captain,
  locked,
  selected,
  dimmed,
  posState = "normal",
  posErrorKey,
  sub,
  anim,
  captainStampKey,
  lockSnapKey,
  scale = 1,
  ariaLabel,
  onTap,
}: {
  player: TokenPlayer;
  points: number | null;
  captain: boolean;
  locked: boolean;
  selected: boolean;
  dimmed: boolean;
  posState?: PosState;
  posErrorKey?: number;
  sub: string;
  anim?: TokenAnim | null;
  captainStampKey?: number;
  lockSnapKey?: number;
  scale?: number;
  ariaLabel: string;
  onTap: () => void;
}) {
  const ring = selected
    ? "border-lampe shadow-[0_0_0_4px_rgb(255_213_74/0.5),0_0_26px_6px_rgb(255_213_74/0.7)]"
    : captain
      ? "border-lampe shadow-[0_0_18px_2px_rgb(255_213_74/0.55)]"
      : "border-white/85 shadow-[0_4px_10px_rgb(0_0_0/0.35)]";
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-testid="player-token"
      style={{ "--s": scale } as CSSProperties}
      className={`arena-anim flex w-20 scale-(--s) flex-col items-center gap-[5px] transition-opacity duration-200 lg:w-[110px] lg:scale-100 lg:gap-1.5 ${dimmed ? "opacity-[0.38]" : ""}`}
    >
      <span
        key={anim ? `${anim.kind}${anim.key}` : "still"}
        style={
          anim?.kind === "pop"
            ? { animationDelay: `${anim.delay}ms` }
            : undefined
        }
        className={`arena-anim relative h-[54px] w-[54px] rounded-full border-[3px] bg-bg lg:h-[70px] lg:w-[70px] ${ring} ${animClass(anim)}`}
      >
        <PlayerPhoto src={player.image} className="h-full w-full" />
        <img
          src={player.clubLogo}
          alt=""
          className="absolute -bottom-1 -left-1.5 h-5 w-5 rounded-full bg-white p-0.5 lg:h-6 lg:w-6"
        />
        <PosBadge
          label={player.posLabel}
          state={posState}
          errorKey={posErrorKey}
          className="absolute -right-3.5 -bottom-[3px] lg:-right-4 lg:text-[13px]"
        />
        {points !== null ? (
          <span
            className={`slant-sm absolute -top-1.5 -right-3 flex h-5 min-w-6 items-center justify-center px-[5px] font-display text-sm font-black lg:h-[22px] lg:min-w-7 lg:text-[15px] ${pointsLook(points)}`}
          >
            {points < 0 ? `−${-points}` : points}
          </span>
        ) : null}
        {captain ? (
          <span
            key={captainStampKey}
            className={`arena-anim absolute -top-[7px] -left-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-lampe font-display text-sm font-black text-nacht shadow-[0_0_12px_rgb(255_213_74/0.8)] lg:h-[26px] lg:w-[26px] lg:text-base ${captainStampKey ? "animate-[arena-stamp_.6s_cubic-bezier(.2,1.3,.4,1)_both]" : ""}`}
          >
            C
          </span>
        ) : null}
      </span>
      <span
        className={`slant flex max-w-full items-center gap-1 overflow-hidden px-[9px] pt-0.5 pb-px font-display text-sm leading-4 font-extrabold tracking-[0.03em] whitespace-nowrap uppercase lg:px-2.5 lg:text-base lg:leading-[18px] ${selected ? "bg-lampe text-nacht" : "bg-plate-bg text-white"}`}
      >
        {locked ? (
          <Lock
            key={lockSnapKey}
            aria-hidden
            strokeWidth={2.6}
            className={`arena-anim h-[11px] w-[11px] shrink-0 origin-[50%_60%] ${lockSnapKey ? "animate-[arena-snap_.55s_cubic-bezier(.2,1.3,.4,1)_both]" : ""}`}
          />
        ) : null}
        <span className="truncate">{player.lastName}</span>
      </span>
      <span className="text-[11px] leading-3 font-semibold whitespace-nowrap text-white/95 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] lg:text-xs lg:leading-[13px]">
        {sub}
      </span>
    </button>
  );
}

const ROW_PAD = ["px-10", "px-[22px]", "px-1", "px-0"] as const;
/** Perspektive: Sturm hinten kleiner, Tor vorne größer (nur mobil). */
export const ROW_SCALE = [0.86, 0.93, 1, 1.04] as const;

/**
 * Trapez-Spielfeld mit Mähstreifen, Kreidelinien und Flutlicht (Arena 4 „Pitch“).
 * `rows`: Sturm, Mittelfeld, Abwehr, Tor (von hinten nach vorne).
 */
export function Pitch({
  rows,
  overlay,
  label,
}: {
  rows: ReactNode[][];
  overlay?: ReactNode;
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className="relative -mx-[18px] h-[452px] overflow-hidden lg:mx-0 lg:h-[600px]"
    >
      <div className="pitch-stripes absolute inset-0 [clip-path:polygon(9%_0,91%_0,100%_100%,0_100%)] lg:[clip-path:polygon(7%_0,93%_0,100%_100%,0_100%)]">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-white/55" />
        <div className="absolute top-0 left-1/2 h-[84px] w-[170px] -translate-1/2 rounded-full border-[3px] border-white/50 lg:h-[110px] lg:w-[220px]" />
        <div className="absolute bottom-0 left-1/2 h-[88px] w-[260px] -translate-x-1/2 border-[3px] border-b-0 border-white/50 lg:h-[120px] lg:w-[360px]" />
        <div className="absolute bottom-0 left-1/2 h-[34px] w-[110px] -translate-x-1/2 border-[3px] border-b-0 border-white/50 lg:h-[46px] lg:w-[150px]" />
      </div>
      <div className="pitch-light pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col justify-between pt-4 pb-3 lg:pt-[22px] lg:pb-4">
        {rows.map((row, i) => (
          <div key={i} className={`flex justify-evenly ${ROW_PAD[i] ?? ""}`}>
            {row}
          </div>
        ))}
      </div>
      {overlay}
    </section>
  );
}

/** Schwebendes Schild beim Tausch: „SCHLOTTERBECK ⇄ ANTON“ (1,3 s). */
export function SwapLabel({ a, b }: { a: string; b: string }) {
  return (
    <div className="arena-anim slant pointer-events-none absolute top-[44%] left-1/2 z-[4] flex animate-[arena-float_1.3s_ease-out_both] items-center gap-2 bg-lampe px-3.5 pt-2 pb-[7px] font-display text-xl leading-none font-black whitespace-nowrap text-nacht uppercase shadow-[0_8px_30px_rgb(0_0_0/0.4),0_0_40px_rgb(255_213_74/0.6)] lg:gap-2.5 lg:px-[18px] lg:text-[26px]">
      {a} <span className="text-2xl lg:text-[30px]">⇄</span> {b}
    </div>
  );
}

/** Bank-Karte: Slot (TW, B1–B3), Foto mit Positions-Badge, Nachname. */
export function BenchCard({
  slot,
  player,
  locked,
  selected,
  dimmed,
  posState = "normal",
  posErrorKey,
  anim,
  lockSnapKey,
  ariaLabel,
  onTap,
}: {
  slot: string;
  player: TokenPlayer;
  locked: boolean;
  selected: boolean;
  dimmed: boolean;
  posState?: PosState;
  posErrorKey?: number;
  anim?: TokenAnim | null;
  lockSnapKey?: number;
  ariaLabel: string;
  onTap: () => void;
}) {
  const slotLabel = (
    <span className="flex items-center gap-1 font-display text-[13px] font-black tracking-[0.08em] text-muted lg:text-xs">
      {locked ? (
        <Lock
          key={lockSnapKey}
          aria-hidden
          strokeWidth={2.6}
          className={`arena-anim h-[11px] w-[11px] origin-[50%_60%] ${lockSnapKey ? "animate-[arena-snap_.55s_cubic-bezier(.2,1.3,.4,1)_both]" : ""}`}
        />
      ) : null}
      {slot}
    </span>
  );
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-testid="bench-card"
      className={`arena-anim flex min-h-11 flex-col items-center gap-1.5 border-2 bg-surface px-1 pt-2.5 pb-[9px] text-text transition-opacity duration-200 lg:flex-row lg:gap-2.5 lg:p-2.5 lg:text-left ${selected ? "border-lampe" : "border-line"} ${dimmed ? "opacity-[0.38]" : ""}`}
    >
      <span className="lg:hidden">{slotLabel}</span>
      <span
        key={anim ? `${anim.kind}${anim.key}` : "still"}
        style={
          anim?.kind === "pop"
            ? { animationDelay: `${anim.delay}ms` }
            : undefined
        }
        className={`arena-anim relative h-[42px] w-[42px] shrink-0 lg:h-11 lg:w-11 ${animClass(anim)}`}
      >
        <PlayerPhoto src={player.image} className="h-full w-full" />
        <PosBadge
          label={player.posLabel}
          state={posState}
          errorKey={posErrorKey}
          className="absolute -right-3 -bottom-[3px] text-[11px] leading-3 lg:-right-2.5"
        />
      </span>
      <span className="min-w-0 max-w-full">
        <span className="hidden lg:block">{slotLabel}</span>
        <span className="block truncate font-display text-sm font-extrabold uppercase lg:text-lg lg:leading-none lg:font-black">
          {player.lastName}
        </span>
      </span>
    </button>
  );
}

/** Kapitäns-Leiste (48 px): Foto, „Kapitän“, Name, Multiplikator. Ploppt beim Wechsel. */
export function CaptainBar({
  name,
  image,
  multiplier,
  popKey,
}: {
  name: string;
  image?: string;
  multiplier: number;
  popKey?: number;
}) {
  return (
    <div
      key={popKey}
      data-testid="captain-bar"
      className={`arena-anim slant-r flex items-center gap-2.5 bg-cap-bg py-[7px] pr-3 pl-2 text-cap-text lg:py-2 lg:pr-3.5 ${popKey ? "animate-[arena-pop_.45s_ease-out_both]" : ""}`}
    >
      <PlayerPhoto
        src={image}
        className="h-[34px] w-[34px] border-2 border-lampe lg:h-10 lg:w-10"
      />
      <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden whitespace-nowrap lg:block">
        <span className="text-[11px] font-bold tracking-[0.14em] text-cap-muted uppercase lg:block">
          Kapitän
        </span>
        <span className="truncate font-display text-[21px] leading-none font-black uppercase lg:block lg:text-[22px]">
          {name}
        </span>
      </div>
      <span className="pr-1.5 font-display text-2xl leading-none font-black text-lampe lg:text-[28px]">
        ×{multiplier}
      </span>
    </div>
  );
}
