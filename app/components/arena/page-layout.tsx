import type { ReactNode } from "react";

/** Inhaltsbereich unter dem Kopf: mobil 18 px Rand und höchstens 560 px, Desktop 36 px. */
export function PageBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto max-w-[560px] px-[18px] pt-[18px] pb-8 lg:max-w-none lg:px-9 lg:pt-6 lg:pb-9 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Zwei Spalten ab 1024 px: Hauptinhalt und eine Seitenspalte (360 px), die beim
 * Scrollen stehen bleibt. Mobil untereinander.
 */
export function TwoCol({
  main,
  side,
  sideWidth = 360,
}: {
  main: ReactNode;
  side: ReactNode;
  sideWidth?: 340 | 360 | 380;
}) {
  const cols = {
    340: "lg:grid-cols-[minmax(0,1fr)_340px]",
    360: "lg:grid-cols-[minmax(0,1fr)_360px]",
    380: "lg:grid-cols-[minmax(0,1fr)_380px]",
  }[sideWidth];
  return (
    <div
      className={`flex flex-col gap-[22px] lg:grid lg:items-start lg:gap-7 ${cols}`}
    >
      <div className="min-w-0">{main}</div>
      <aside className="flex min-w-0 flex-col gap-[18px] lg:sticky lg:top-6">
        {side}
      </aside>
    </div>
  );
}

/** Abschnittsüberschrift 26 px in Versalien. */
export function SectionTitle({
  children,
  aside,
  id,
}: {
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2
        id={id}
        className="font-display text-[26px] leading-tight font-black uppercase"
      >
        {children}
      </h2>
      {aside ? (
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          {aside}
        </span>
      ) : null}
    </div>
  );
}
