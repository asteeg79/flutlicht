import Link from "next/link";

const TABS = [
  { href: "/tabelle", label: "Manager" },
  { href: "/tabelle/bundesliga", label: "Bundesliga" },
] as const;

/** Reiter unter „Tabelle“: unsere Liga und die echte Bundesliga. */
export function TableTabs({
  active,
}: {
  active: (typeof TABS)[number]["href"];
}) {
  return (
    <nav aria-label="Tabellen" className="-mt-3 mb-5 grid grid-cols-2 gap-1.5">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`flex h-9 items-center justify-center rounded-lg text-sm font-semibold ${
            t.href === active
              ? "bg-text text-bg"
              : "border border-line text-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
