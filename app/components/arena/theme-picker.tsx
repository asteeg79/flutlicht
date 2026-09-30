"use client";

import { useTheme } from "@/hooks/useTheme";
import type { ThemePref } from "@/lib/theme";

const MODES: { pref: ThemePref; label: string }[] = [
  { pref: "dark", label: "Dunkel" },
  { pref: "light", label: "Hell" },
  { pref: "system", label: "System" },
];

/** Darstellung Dunkel/Hell/System; schaltet sofort um und merkt sich die Wahl. */
export function ThemePicker() {
  const { pref, setPref } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Darstellung"
      className="grid grid-cols-3 gap-1"
    >
      {MODES.map((m) => (
        <button
          key={m.pref}
          type="button"
          role="radio"
          aria-checked={pref === m.pref}
          onClick={() => setPref(m.pref)}
          className={`slant h-11 font-display text-lg font-black uppercase ${
            pref === m.pref ? "bg-lampe text-nacht" : "bg-surface text-muted"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
