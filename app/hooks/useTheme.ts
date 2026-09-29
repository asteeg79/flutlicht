"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  parseThemePref,
  resolveTheme,
  THEME_KEY,
  type Theme,
  type ThemePref,
} from "@/lib/theme";

const LIGHT_QUERY = "(prefers-color-scheme: light)";
const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const html = document.documentElement;
  html.dataset.theme = theme;
  html.style.colorScheme = theme;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Darstellung Dunkel/Hell/System; „System“ folgt Änderungen des Betriebssystems live. */
export function useTheme(): {
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
} {
  const pref = useSyncExternalStore<ThemePref>(
    subscribe,
    readPref,
    () => "system",
  );

  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY);
    const sync = () => apply(resolveTheme(readPref(), media.matches));
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Privater Modus: die Wahl gilt dann nur bis zum Neuladen.
    }
    apply(resolveTheme(next, window.matchMedia(LIGHT_QUERY).matches));
    listeners.forEach((l) => l());
  }, []);

  return { pref, setPref };
}
