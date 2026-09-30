"use client";

import { useSyncExternalStore } from "react";

/** true, solange die Media Query zutrifft; auf dem Server immer false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desktop-Layout ab 1024 px (Arena 3.2). */
export const DESKTOP = "(min-width: 1024px)";
