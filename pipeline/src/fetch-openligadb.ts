// Holt den OpenLigaDB-Spielplan der Saison nach raw/openligadb/ (KONZEPT 5.3, 6.4).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fetchJson } from "./sources/http";
import { RAW_DIR } from "./paths";

export const OPENLIGA_SEASON = 2026;

export function openligaSeasonPath(rawDir = RAW_DIR): string {
  return join(rawDir, "openligadb", `season-${OPENLIGA_SEASON}.json`);
}

export async function fetchOpenligaSeason(now = new Date()): Promise<string> {
  const url = `https://api.openligadb.de/getmatchdata/bl1/${OPENLIGA_SEASON}`;
  const data = await fetchJson(url, { maxRetries: 3, backoffBaseMs: 2000 });
  const path = openligaSeasonPath();
  await mkdir(dirname(path), { recursive: true });
  const envelope = { fetchedAt: now.toISOString(), url, phase: "season", data };
  await writeFile(path, JSON.stringify(envelope, null, 2) + "\n", "utf8");
  return path;
}
