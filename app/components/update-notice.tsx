"use client";

import { useUpdateAvailable } from "@/hooks/useVersion";

/** Hinweis auf einen neuen Build; da jeder Daten-Commit neu baut, meist neue Punkte. */
export function UpdateNotice() {
  if (!useUpdateAvailable()) return null;
  return (
    <div
      role="status"
      className="mx-auto mb-4 flex max-w-lg items-center justify-between gap-3 rounded-xl border border-lampe/60 bg-nacht-hoch px-4 py-2 text-sm"
    >
      <span>Neuer Stand verfügbar.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="font-semibold text-lampe"
      >
        Neu laden
      </button>
    </div>
  );
}
