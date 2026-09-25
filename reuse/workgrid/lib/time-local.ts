// Lokale (nicht-UTC) Datums-/Zeitformatierung — bewusst ohne date-fns, damit
// auch die Domänen-Module (lib/domain/**) sie ohne zusätzliche Abhängigkeit
// nutzen können. Uhrzeit/Datum eines Historien-Eintrags werden lokal geführt.

/** Zweistellig mit führender Null. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Datum als lokales yyyy-MM-dd. */
export function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Uhrzeit als lokales HH:mm. */
export function toLocalHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
