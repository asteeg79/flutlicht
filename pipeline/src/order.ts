// Reihenfolge wie Array.prototype.sort() ohne Argument (nach UTF-16-Code-Einheiten),
// aber ausdrücklich: Dateinamen und ISO-Zeitstempel sollen nicht von der Sprache abhängen.
export function byCodeUnit(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
