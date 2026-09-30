"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved";

/** Zustand der Speichern-Pille: begin() beim Absenden, done(ok) mit dem Ergebnis. */
export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const begin = useCallback(() => {
    clearTimeout(timer.current);
    setState("saving");
  }, []);
  const done = useCallback((ok: boolean) => {
    clearTimeout(timer.current);
    if (!ok) return setState("idle");
    setState("saved");
    timer.current = setTimeout(() => setState("idle"), 1100);
  }, []);
  return { state, begin, done };
}

/**
 * „◌ speichert …“ → „✓ gespeichert“, wie eine Dynamic Island oben mittig
 * (Desktop oben rechts). Für Screenreader zählt nur „gespeichert“.
 */
export function SavePill({ state }: { state: SaveState }) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {state === "saved" ? "gespeichert" : ""}
      </p>
      {state === "idle" ? null : (
        <div
          aria-hidden
          data-testid="save-pill"
          data-state={state}
          className="arena-anim fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 z-50 flex -translate-x-1/2 animate-[arena-fade_.15s_both] items-center gap-1.5 rounded-full bg-save-bg px-2.5 pt-[5px] pb-1 font-display text-[13px] font-extrabold tracking-[0.06em] text-save-text uppercase shadow-[0_4px_14px_rgb(0_0_0/0.3)] lg:top-6 lg:right-9 lg:left-auto lg:translate-x-0"
        >
          {state === "saving" ? (
            <>
              <span className="arena-anim h-[11px] w-[11px] animate-[arena-spin_.7s_linear_infinite] rounded-full border-2 border-current border-r-transparent" />
              speichert …
            </>
          ) : (
            <>
              <span className="text-save-ok">✓</span>gespeichert
            </>
          )}
        </div>
      )}
    </>
  );
}
