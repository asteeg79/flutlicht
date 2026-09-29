"use client";

import { useUpdateAvailable } from "@/hooks/useVersion";

/** Hinweis auf einen neuen Build; da jeder Daten-Commit neu baut, meist neue Punkte. */
export function UpdateNotice() {
  if (!useUpdateAvailable()) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b-2 border-lampe bg-surface px-[18px] pt-[calc(env(safe-area-inset-top)+8px)] pb-2 text-sm lg:px-9 lg:pt-2"
    >
      <span>Neuer Stand verfügbar.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 font-display text-base font-black tracking-[0.04em] text-accent uppercase"
      >
        Neu laden
      </button>
    </div>
  );
}
