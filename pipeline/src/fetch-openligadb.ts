// Holt den OpenLigaDB-Spielplan der Saison nach raw/openligadb/ (KONZEPT 5.3, 6.4).
// Die erste bekannte Anstoßzeit jedes Spiels wird in original-kickoffs.json festgehalten,
// damit die Pipeline verlegte Spiele erkennt (2.9).
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fetchJson } from "./sources/http";
import { RAW_DIR } from "./paths";
import { SEASON_CONSTANTS } from "./steps/season";

const OPENLIGA_SEASON = SEASON_CONSTANTS.openligaSeason;

export function openligaSeasonPath(rawDir = RAW_DIR): string {
  return join(rawDir, "openligadb", `season-${OPENLIGA_SEASON}.json`);
}

export function originalKickoffsPath(rawDir = RAW_DIR): string {
  return join(rawDir, "openligadb", "original-kickoffs.json");
}

/** Ergänzt nur Spiele, die noch keinen Eintrag haben; vorhandene Zeiten bleiben unverändert. */
export function mergeOriginalKickoffs(
  existing: Readonly<Record<string, string>>,
  matches: readonly { matchID: number; matchDateTimeUTC: string }[],
): Record<string, string> {
  const out = { ...existing };
  for (const m of matches) out[String(m.matchID)] ??= m.matchDateTimeUTC;
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => Number(a) - Number(b)),
  );
}

async function writePretty(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function fetchOpenligaSeason(now = new Date()): Promise<string> {
  const url = `https://api.openligadb.de/getmatchdata/bl1/${OPENLIGA_SEASON}`;
  const data = await fetchJson<{ matchID: number; matchDateTimeUTC: string }[]>(
    url,
    {
      maxRetries: 3,
      backoffBaseMs: 2000,
    },
  );
  const path = openligaSeasonPath();
  await writePretty(path, {
    fetchedAt: now.toISOString(),
    url,
    phase: "season",
    data,
  });
  const originals = originalKickoffsPath();
  const existing = existsSync(originals)
    ? JSON.parse(await readFile(originals, "utf8"))
    : {};
  await writePretty(originals, mergeOriginalKickoffs(existing, data));
  return path;
}
