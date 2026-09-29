import type { ReactNode } from "react";

/**
 * Anzeigetafel-Kachel: Label über Zahl (mit kleiner Einheit). `accent` = gelbe Zahl.
 * `plainOnMobile`: mobil ohne Kachelgrund direkt im Kopf (Team), ab Desktop als Kachel.
 */
export function BoardTile({
  label,
  value,
  unit,
  accent = false,
  size = "md",
  plainOnMobile = false,
  className = "",
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  accent?: boolean;
  size?: "md" | "lg";
  plainOnMobile?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const box = plainOnMobile
    ? "lg:bg-board-bg lg:px-4 lg:py-2.5 lg:text-board-text"
    : "bg-board-bg px-2.5 py-[7px] text-board-text lg:px-4 lg:py-2.5";
  return (
    <div className={`min-w-0 lg:min-w-[110px] ${box} ${className}`}>
      <p
        className={`truncate text-[11px] font-bold tracking-[0.14em] uppercase ${plainOnMobile ? "text-hero-muted lg:text-board-text lg:opacity-80" : "opacity-80"}`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 font-display leading-[0.95] font-black whitespace-nowrap tabular-nums ${size === "lg" ? "text-[52px] lg:text-[40px]" : "text-[28px] lg:text-[32px]"} ${accent ? (plainOnMobile ? "lg:text-board-num" : "text-board-num") : ""}`}
      >
        {value}
        {unit ? (
          <span className="text-[14px] opacity-70 lg:text-[16px]">{unit}</span>
        ) : null}
      </p>
      {children}
    </div>
  );
}
