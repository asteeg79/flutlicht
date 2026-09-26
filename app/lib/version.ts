// Version des Builds (scripts/gen-version.mjs → next.config.js → NEXT_PUBLIC_APP_*).
// Eigenes Modul ohne "use client", damit auch Server-Komponenten es nutzen können.

export const APP_VERSION = Number(process.env.NEXT_PUBLIC_APP_VERSION ?? 0);
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";

/** Commit-Zeitstempel YYYYMMDDHHMM → CalVer "v2026.09.26-1908". */
export function formatVersion(version: number): string {
  const s = String(version);
  if (s.length !== 12) return `v${version}`;
  return `v${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}-${s.slice(8, 12)}`;
}
