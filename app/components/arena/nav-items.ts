import {
  ArrowLeftRight,
  CalendarDays,
  History,
  ListOrdered,
  Settings,
  Shirt,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/team", label: "Team", Icon: Shirt },
  { href: "/markt", label: "Markt", Icon: ArrowLeftRight },
  { href: "/spieltag", label: "Spieltag", Icon: CalendarDays },
  { href: "/tabelle", label: "Tabelle", Icon: ListOrdered },
  { href: "/historie", label: "Historie", Icon: History },
  { href: "/einstellungen", label: "Optionen", Icon: Settings },
] as const;

/** Welcher Eintrag leuchtet: Unterseiten zählen mit (/spieltag/5, /tabelle/bundesliga); Spieler zum Markt. */
export function activeNavIndex(pathname: string): number {
  if (pathname.startsWith("/spieler/")) return 1;
  if (pathname === "/admin") return 5;
  return NAV_ITEMS.findIndex(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
}
