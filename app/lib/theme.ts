// Hell/Dunkel (Arena 2.1): Wahl in localStorage, angewandt als html[data-theme].

export type ThemePref = "system" | "dark" | "light";
export type Theme = "dark" | "light";

export const THEME_KEY = "flutlicht-theme";

/** Gespeicherter Wert → Wahl; alles Unbekannte heißt „System“. */
export function parseThemePref(stored: string | null): ThemePref {
  return stored === "dark" || stored === "light" ? stored : "system";
}

export function resolveTheme(pref: ThemePref, systemLight: boolean): Theme {
  if (pref !== "system") return pref;
  return systemLight ? "light" : "dark";
}

/**
 * Läuft im <head> vor dem ersten Paint, damit nie das falsche Theme aufblitzt.
 * Dieselbe Regel wie parseThemePref/resolveTheme, nur ohne Module.
 */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var t=s==="dark"||s==="light"?s:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";var e=document.documentElement;e.dataset.theme=t;e.style.colorScheme=t}catch(_){}})()`;
