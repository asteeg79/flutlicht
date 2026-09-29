"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SlantTag, type TagVariant } from "@/components/arena/slant-tag";

export interface CompactInfo {
  title: string;
  /** Wichtigste Zahl rechts („Fixiert in 02:47:18“, „12,4 Mio · 2 frei“). */
  right?: ReactNode;
  /** Rot statt Gelb (Countdown unter 10 Min.). */
  urgent?: boolean;
}

/**
 * Kopf jeder Seite (Arena 3.1/3.2): Status-Tag, rechts Uhr oder Countdown, Titel
 * einzeilig, darunter die Anzeigetafel. Mobil fährt nach 120 px Scrollen die
 * kompakte Leiste herein (IntersectionObserver, kein Scroll-Event).
 */
export function HeroHeader({
  tag,
  tagVariant = "hero",
  title,
  right,
  above,
  compact,
  children,
  board = "row",
}: {
  tag?: ReactNode;
  tagVariant?: TagVariant;
  title: ReactNode;
  right?: ReactNode;
  /** Über dem Tag, z. B. der Zurück-Link auf der Spielerseite. */
  above?: ReactNode;
  compact?: CompactInfo;
  children?: ReactNode;
  /** Tafel mobil als Zeile ohne Kacheln oder als Kachel-Raster; Desktop immer rechts. */
  board?: "row" | "grid";
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !compact) return;
    const io = new IntersectionObserver(([entry]) =>
      setCollapsed(!entry!.isIntersecting && entry!.boundingClientRect.top < 0),
    );
    io.observe(el);
    return () => io.disconnect();
  }, [compact]);

  return (
    <div className="relative">
      {/* Außerhalb des Kopfes, damit ihn ein kurzer Kopf nicht abschneidet. */}
      <div
        ref={sentinel}
        aria-hidden
        className="pointer-events-none absolute top-[120px] h-px w-px"
      />
      <header className="hero-bg relative overflow-hidden px-[18px] pt-[calc(env(safe-area-inset-top)+20px)] pb-3.5 lg:px-9 lg:pt-7 lg:pb-[22px]">
        <div className="mx-auto max-w-[560px] lg:flex lg:max-w-none lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0">
            {above}
            {tag || right ? (
              <div className="mb-2 flex items-center justify-between gap-2.5 lg:mb-2.5 lg:justify-start lg:gap-3">
                {tag ? (
                  <SlantTag variant={tagVariant}>{tag}</SlantTag>
                ) : (
                  <span />
                )}
                {right ? (
                  <div className="flex min-w-0 items-center gap-[7px] text-xs font-bold tracking-[0.06em] uppercase">
                    {right}
                  </div>
                ) : null}
              </div>
            ) : null}
            <h1 className="truncate font-display text-[36px] leading-[0.95] font-black uppercase lg:text-5xl lg:leading-[0.9]">
              {title}
            </h1>
          </div>
          {children ? (
            <div
              className={`mt-2.5 lg:mt-0 lg:flex lg:shrink-0 lg:gap-2 ${board === "row" ? "flex items-end gap-[22px]" : "grid grid-cols-[1fr_1.25fr] gap-2"}`}
            >
              {children}
            </div>
          ) : null}
        </div>
      </header>
      {compact ? <CompactBar info={compact} visible={collapsed} /> : null}
    </div>
  );
}

/** Kompakte Leiste beim Scrollen (nur mobil): Titel links, Kernzahl rechts. */
export function CompactBar({
  info,
  visible,
}: {
  info: CompactInfo;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden={!visible}
      data-testid="compact-bar"
      data-visible={visible}
      className={`arena-anim fixed inset-x-0 top-0 z-30 border-b-2 border-compact-line bg-compact-bg pt-[env(safe-area-inset-top)] text-hero-text shadow-[0_8px_20px_rgb(0_0_0/0.22)] transition-transform duration-250 ease-out lg:hidden ${visible ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="mx-auto flex h-[46px] max-w-[560px] items-center justify-between gap-3 px-[18px]">
        <span className="min-w-0 truncate font-display text-2xl leading-none font-black uppercase">
          {info.title}
        </span>
        {info.right ? (
          <span
            className={`shrink-0 font-display text-[17px] leading-none font-extrabold tracking-[0.04em] whitespace-nowrap uppercase tabular-nums ${info.urgent ? "text-urgent" : "text-compact-num"}`}
          >
            {info.right}
          </span>
        ) : null}
      </div>
    </div>
  );
}
