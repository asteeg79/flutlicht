"use client";

import {
  ArrowLeftRight,
  CalendarDays,
  History,
  ListOrdered,
  Settings,
  Shirt,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/team", label: "Team", Icon: Shirt },
  { href: "/markt", label: "Markt", Icon: ArrowLeftRight },
  { href: "/spieltag", label: "Spieltag", Icon: CalendarDays },
  { href: "/tabelle", label: "Tabelle", Icon: ListOrdered },
  { href: "/historie", label: "Historie", Icon: History },
  { href: "/einstellungen", label: "Optionen", Icon: Settings },
];

/** Untere Navigation; die Kreidelinie oben ist die Seitenlinie, der aktive Punkt brennt gelb. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-kreide/25 bg-nacht-hoch/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-lampe" : "text-kreide-matt hover:text-kreide"
                }`}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute -top-[2px] h-[2px] w-10 bg-lampe shadow-[0_0_12px_2px_rgb(255_213_74/0.6)]"
                  />
                ) : null}
                <Icon
                  aria-hidden
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
