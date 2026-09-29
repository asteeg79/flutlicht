import type { ReactNode } from "react";

export type TagVariant = "hero" | "lampe" | "nacht" | "live" | "off";

const LOOK: Record<TagVariant, string> = {
  hero: "bg-tag-bg text-tag-text",
  lampe: "bg-lampe text-nacht",
  nacht: "bg-nacht text-lampe",
  live: "bg-karte text-white",
  off: "bg-tag-off-bg text-tag-off-text",
};

/** Schräger Status-Tag („Spieltag 05“, „Fenster zu“, „Live · läuft“ mit Puls). */
export function SlantTag({
  variant = "hero",
  children,
  className = "",
}: {
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`slant inline-flex items-center gap-2 px-3 pt-1 pb-[3px] font-display text-[15px] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase ${LOOK[variant]} ${className}`}
    >
      {variant === "live" ? <PulseDot className="bg-white" /> : null}
      {children}
    </span>
  );
}

/** Pulsierender Punkt (Live, Countdown); unter 10 Min. schneller. */
export function PulseDot({
  fast = false,
  className = "bg-live",
}: {
  fast?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`arena-anim inline-block h-2 w-2 shrink-0 rounded-full ${fast ? "animate-[arena-pulse_.6s_ease-in-out_infinite]" : "animate-[arena-pulse_1.4s_ease-in-out_infinite]"} ${className}`}
    />
  );
}
