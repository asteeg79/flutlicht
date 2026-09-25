// Regelverstöße mit deutscher Meldung, die die App direkt anzeigen kann.

export interface Violation {
  code: string;
  message: string;
  playerId?: number;
}

/** 64.5 → "64,5 Mio." */
export function formatMio(mio: number): string {
  return `${mio.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
}
