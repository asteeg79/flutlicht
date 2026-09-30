import Link from "next/link";

const TABS = [
  { href: "/tabelle", label: "Managerrunde" },
  { href: "/tabelle/bundesliga", label: "Bundesliga" },
] as const;

/** Reiter im Kopf von „Tabelle“: unsere Runde und die echte Bundesliga. */
export function TableTabs({
  active,
}: {
  active: (typeof TABS)[number]["href"];
}) {
  return (
    <nav
      aria-label="Tabellen"
      className="mt-2.5 flex w-full gap-1 lg:mt-0 lg:w-auto"
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`slant flex h-[42px] flex-1 items-center justify-center font-display text-[19px] font-black uppercase lg:h-11 lg:flex-none lg:px-[22px] ${
            t.href === active
              ? "bg-tag-bg text-tag-text"
              : "bg-surface-alt text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
