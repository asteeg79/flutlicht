/** Zahl aus einem Eingabefeld, deutsches Komma erlaubt: "64,5" → 64.5. */
export function parseDecimal(input: string): number {
  return Number(input.trim().replace(",", "."));
}
