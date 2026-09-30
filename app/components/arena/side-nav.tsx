"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavIndex, NAV_ITEMS } from "@/components/arena/nav-items";
import { CountdownText } from "@/components/arena/countdown";
import { GuideLink } from "@/components/guide/guide-link";
import { CircleHelp } from "lucide-react";
import { PulseDot } from "@/components/arena/slant-tag";

export interface SideInfo {
  season: string;
  teamName: string;
  /** „Jonas · Platz 2 von 8 · 356 P.“ */
  teamLine: string;
  lock: {
    label: string;
    target: string;
    /** „Anpfiff Fr., 20:30 · Frankfurt – Mainz 05“ */
    detail: string;
  } | null;
  serverNow: string;
}

/**
 * Seitenleiste ab 1024 px (Arena 3.2), immer dunkel: Wortmarke, Team-Karte,
 * Navigation mit gleitendem Balken links, unten der Countdown zur nächsten Sperre.
 */
export function SideNav({ info }: { info: SideInfo }) {
  const active = activeNavIndex(usePathname());
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-white/10 bg-side-bg text-kreide lg:flex">
      <div className="px-6 pt-[26px] pb-[18px]">
        <p className="font-display text-[38px] leading-[0.85] font-black tracking-[0.01em] uppercase">
          Flut<span className="text-lampe">licht</span>
        </p>
        <p className="mt-1.5 text-[11px] font-bold tracking-[0.14em] text-kreide-matt uppercase">
          Saison {info.season}
        </p>
      </div>
      <div className="slant-r mx-4 mb-[18px] bg-white/[0.06] px-3.5 py-3">
        <p className="truncate font-display text-[22px] leading-none font-black uppercase">
          {info.teamName}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-kreide-matt">
          {info.teamLine}
        </p>
      </div>
      <nav
        aria-label="Hauptnavigation"
        className="relative flex flex-col gap-0.5 px-3"
      >
        {active >= 0 ? (
          <span
            aria-hidden
            className="arena-anim absolute left-0 h-12 w-1 bg-lampe shadow-[0_0_14px_2px_rgb(255_213_74/0.6)] transition-[top] duration-[350ms] ease-[cubic-bezier(.3,1.3,.5,1)]"
            style={{ top: active * 50 }}
          />
        ) : null}
        {NAV_ITEMS.map(({ href, label, Icon }, i) => (
          <Link
            key={href}
            href={href}
            aria-current={i === active ? "page" : undefined}
            className={`flex h-12 items-center gap-3.5 px-3.5 font-display text-[19px] font-extrabold tracking-[0.05em] uppercase transition-colors duration-250 ${
              i === active
                ? "bg-lampe/[0.08] text-lampe"
                : "text-kreide-matt hover:text-kreide"
            }`}
          >
            <Icon aria-hidden className="h-[22px] w-[22px]" strokeWidth={2} />
            {label}
          </Link>
        ))}
      </nav>
      <GuideLink
        chapter="idee"
        className="mx-3 mt-3 flex min-h-11 items-center gap-3.5 px-3.5 text-sm font-semibold text-kreide-matt hover:text-kreide"
      >
        <CircleHelp aria-hidden className="h-[22px] w-[22px]" strokeWidth={2} />
        Anleitung
      </GuideLink>
      {info.lock ? (
        <div className="mt-auto border-t border-white/10 px-6 pt-[18px] pb-[22px]">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-kreide-matt uppercase">
            <PulseDot />
            {info.lock.label}
          </p>
          <p className="mt-1 font-display text-[32px] leading-none font-black text-lampe">
            <CountdownText
              target={info.lock.target}
              serverNow={info.serverNow}
            />
          </p>
          <p className="mt-0.5 text-xs font-semibold text-kreide-matt">
            {info.lock.detail}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
