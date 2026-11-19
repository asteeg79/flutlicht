// `pipeline build`: rechnet data/ vollständig aus raw/ neu (KONZEPT 6.5), deterministisch und idempotent.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import {
  fixtureCounts,
  Fixtures,
  ManualNeeded,
  MappingReview,
  MarketHistory,
  MatchdayPoints,
  Meta,
  MissingValues,
  Players,
  priceTimeline,
  Season,
  Teams,
  type Fixture,
  type ManualNeededEntry,
  type ManualTeam,
  type Team,
} from "@fm/core";
import { writeJson } from "./io/json";
import {
  readDcaribou,
  readImageIds,
  readManual,
  readMatchSources,
  readMinutes,
  readOpenliga,
  readRounds,
  readSquadSnapshots,
  readTmCrawl,
} from "./raw";
import { buildFixtures } from "./steps/fixtures";
import { buildPlayers } from "./steps/players";
import { buildPoints, chooseMatchData } from "./steps/points";
import { sanityCheck } from "./steps/sanity";
import { buildSeason } from "./steps/season";
import { byCodeUnit } from "./order";

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildTeams(teams: readonly ManualTeam[]): Team[] {
  return teams.map((t) => ({ ...t, logo: `/img/clubs/${t.id}.webp` }));
}

/** Beendete, gewertete Spiele ohne Daten seit mehr als 3 Tagen (KONZEPT 5.8). */
export function manualNeeded(
  fixtures: readonly Fixture[],
  now: Date,
): ManualNeededEntry[] {
  return fixtures
    .filter(
      (f) =>
        f.dataState === "pending" &&
        fixtureCounts(f) &&
        now.getTime() - Date.parse(f.kickoffUtc) > 3 * DAY_MS,
    )
    .map((f) => ({
      matchday: f.matchday,
      openligaMatchId: f.openligaMatchId,
      ...(f.sofascoreEventId === undefined
        ? {}
        : { sofascoreEventId: f.sofascoreEventId }),
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      kickoffUtc: f.kickoffUtc,
    }));
}

/** Alles, was die Rechnung aus raw/ braucht; gelesen von readInputs. */
export interface RawInputs {
  manual: Awaited<ReturnType<typeof readManual>>;
  openliga: Awaited<ReturnType<typeof readOpenliga>>;
  matches: Awaited<ReturnType<typeof readMatchSources>>;
  snapshots: Awaited<ReturnType<typeof readSquadSnapshots>>;
  tmCrawl: Awaited<ReturnType<typeof readTmCrawl>>;
  dcaribou: Awaited<ReturnType<typeof readDcaribou>>;
  minutes: Awaited<ReturnType<typeof readMinutes>>;
  rounds: Awaited<ReturnType<typeof readRounds>>;
  imageIds: Awaited<ReturnType<typeof readImageIds>>;
}

/** Eine fertige, validierte Datei für data/ (Pfad relativ zu data/). */
export interface DataFile {
  file: string;
  json: string;
  write: (dataDir: string) => Promise<void>;
}

export async function readInputs(
  rawDir: string,
  imgDir: string,
  warn: (message: string) => void,
): Promise<RawInputs> {
  return {
    manual: await readManual(rawDir),
    openliga: await readOpenliga(rawDir),
    matches: await readMatchSources(rawDir),
    snapshots: await readSquadSnapshots(rawDir, warn),
    tmCrawl: await readTmCrawl(rawDir),
    dcaribou: await readDcaribou(rawDir),
    minutes: await readMinutes(rawDir),
    rounds: await readRounds(rawDir),
    imageIds: await readImageIds(join(imgDir, "players")),
  };
}

/**
 * Die Rechnung raw/ → data/ ohne Ein- und Ausgabe: alle Dateien validiert, dazu
 * meta.json mit Hash über den Inhalt. Wirft beim Sanity-Guard, dann wird nichts geschrieben.
 */
export function computeData(
  raw: RawInputs,
  warn: (message: string) => void,
): DataFile[] {
  const { manual, openliga } = raw;
  const now = new Date(openliga.fetchedAt);
  const matchData = chooseMatchData(raw.matches);

  const teams = buildTeams(manual.teams);
  const imported = buildPlayers({
    teams: manual.teams,
    snapshots: raw.snapshots,
    tmCrawl: raw.tmCrawl,
    dcaribou: raw.dcaribou,
    manualPositions: manual.positions,
    manualValues: manual.values,
    manualMapping: manual.mapping,
    imageIds: raw.imageIds,
  });
  const season = buildSeason(
    imported.players,
    raw.minutes,
    manual.season,
    imported.vMaxEur,
  );
  const fixtures = buildFixtures({
    matches: openliga.matches,
    originals: openliga.originals,
    rounds: raw.rounds,
    teams: manual.teams,
    dataKindOf: (id) => matchData.get(id)?.kind,
    now,
  });
  const points = buildPoints(fixtures, matchData, imported.players, now, warn);
  const market = priceTimeline(
    imported.players,
    points,
    season.firstScoredMatchday,
  );
  const players = imported.players.map((p) => ({
    ...p,
    price: market.prices.get(p.id) ?? p.price,
  }));

  const errors = sanityCheck({ teams, players, fixtures, points });
  if (errors.length > 0) throw new Error(`Sanity-Guard: ${errors.join("; ")}`);

  let lastFinalMatchday: number | null = null;
  for (const md of points) {
    if (md.status !== "final" || md.matchday !== (lastFinalMatchday ?? 0) + 1)
      break;
    lastFinalMatchday = md.matchday;
  }

  const files: DataFile[] = [];
  const prepare = <T>(file: string, schema: z.ZodType<T>, value: T) => {
    const valid = schema.parse(value);
    files.push({
      file,
      json: JSON.stringify(valid),
      write: (dataDir) => writeJson(join(dataDir, file), schema, valid),
    });
  };
  prepare("teams.json", Teams, teams);
  prepare("players.json", Players, players);
  prepare("season.json", Season, season);
  prepare("fixtures.json", Fixtures, fixtures);
  for (const md of points) prepare(pointsFile(md.matchday), MatchdayPoints, md);
  prepare("market/history.json", MarketHistory, market.history);
  prepare("review/mapping.json", MappingReview, imported.mappingReview);
  prepare("review/missing-values.json", MissingValues, imported.missingValues);
  prepare(
    "review/manual-needed.json",
    ManualNeeded,
    manualNeeded(fixtures, now),
  );

  const hash = createHash("sha256");
  for (const f of files) hash.update(f.file).update(f.json);
  const generatedAt = [openliga.fetchedAt, ...points.map((p) => p.generatedAt)]
    .map((t) => new Date(t).toISOString())
    .sort(byCodeUnit)
    .at(-1)!;
  prepare("meta.json", Meta, {
    dataVersion: hash.digest("hex").slice(0, 12),
    generatedAt,
    lastFinalMatchday,
  });
  return files;
}

/** Schreibt die Dateien und entfernt Spieltagsdateien, die es nicht mehr gibt. */
export async function writeData(
  dataDir: string,
  files: readonly DataFile[],
): Promise<void> {
  for (const f of files) await f.write(dataDir);
  await removeStalePoints(
    dataDir,
    new Set(files.map((f) => f.file).filter((f) => f.startsWith("points/"))),
  );
}

/** `pipeline build`: lesen, rechnen (erst alles validieren), dann schreiben; ein Fehler hinterlässt kein halbes data/. */
export async function build(
  rawDir: string,
  dataDir: string,
  imgDir: string,
  warn: (message: string) => void = console.warn,
): Promise<void> {
  const files = computeData(await readInputs(rawDir, imgDir, warn), warn);
  await writeData(dataDir, files);
}

function pointsFile(matchday: number): string {
  return `points/md-${String(matchday).padStart(2, "0")}.json`;
}

async function removeStalePoints(
  dataDir: string,
  keep: ReadonlySet<string>,
): Promise<void> {
  const dir = join(dataDir, "points");
  if (!existsSync(dir)) return;
  for (const file of await readdir(dir)) {
    if (!keep.has(`points/${file}`)) await rm(join(dir, file));
  }
}
