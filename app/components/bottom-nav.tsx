"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavIndex, NAV_ITEMS } from "@/components/arena/nav-items";

/**
 * Untere Navigation (mobil, Arena 3.1): sechs Einträge und ein einziger gelber Balken,
 * der mit leichtem Überschwung zum aktiven Eintrag gleitet.
 */
export function BottomNav() {
  const active = activeNavIndex(usePathname());
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-nav-line bg-nav-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {active >= 0 ? (
        <span
          aria-hidden
          className="arena-anim absolute -top-0.5 z-[1] -ml-5 h-[3px] w-10 bg-lampe shadow-[0_0_12px_2px_rgb(255_213_74/0.6)] transition-[left] duration-[380ms] ease-[cubic-bezier(.3,1.35,.5,1)]"
          style={{
            left: `calc(0.5rem + (100% - 1rem) * ${(active + 0.5) / NAV_ITEMS.length})`,
          }}
        />
      ) : null}
      <ul className="grid h-[62px] grid-cols-6 px-2">
        {NAV_ITEMS.map(({ href, label, Icon }, i) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={i === active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-[3px] font-display text-[clamp(10px,2.9vw,12px)] font-extrabold tracking-[0.02em] whitespace-nowrap uppercase transition-colors duration-300 ${
                i === active ? "text-nav-active" : "text-nav-muted"
              }`}
            >
              <Icon
                aria-hidden
                className="h-5 w-5"
                strokeWidth={i === active ? 2.2 : 2}
              />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
