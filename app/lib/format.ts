// Deutsche Anzeigeformate der Arena-Oberfläche (Zeiten in Europe/Berlin).
import { formatMio, TIMEZONE } from "@fm/core";

const weekdayTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Fr., 20:30" */
export function formatWeekdayTime(iso: string): string {
  return weekdayTime.format(new Date(iso));
}

/** Mio.-Zahl ohne Einheit, eine Nachkommastelle: 4.6 → "4,6", 12 → "12,0". */
export function mioNumber(mio: number): string {
  return mio.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Form mit echtem Minus, höchstens eine Nachkommastelle: −1.25 → "−1,3"; ohne Wert „–“. */
export function formatForm(form: number | null | undefined): string {
  return form == null
    ? "–"
    : form
        .toLocaleString("de-DE", { maximumFractionDigits: 1 })
        .replace("-", "−");
}

/** Mit echtem Minus: −5 → "−5", 3 → "+3", 0 → "0". */
export function signedInt(n: number): string {
  if (n > 0) return `+${n}`;
  return n < 0 ? `−${-n}` : "0";
}

/** Nachname fürs Namensschild: „J. Friedrich“ → „Friedrich“, „E.Duarte“ → „Duarte“, „Rômulo“ bleibt. */
export function lastName(shortName: string): string {
  return shortName.replace(/^\p{Lu}[\p{L}-]*\.\s*/u, "") || shortName;
}

export { formatMio };
