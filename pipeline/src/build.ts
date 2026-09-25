// `pipeline build`: rechnet data/ vollständig aus raw/ neu (KONZEPT 6.5).
// M3: Schritte teams, players, season, review. Fixtures, Punkte und Markt folgen in M4.
import { join } from "node:path";
import type { z } from "zod";
import {
  MappingReview,
  MissingValues,
  Players,
  Season,
  Teams,
  type ManualTeam,
  type Team,
} from "@fm/core";
import { writeJson } from "./io/json";
import {
  readDcaribou,
  readImageIds,
  readManual,
  readMinutes,
  readSquadSnapshots,
  readTmCrawl,
} from "./raw";
import { buildPlayers } from "./steps/players";
import { buildSeason } from "./steps/season";

export function buildTeams(teams: readonly ManualTeam[]): Team[] {
  return teams.map((t) => ({ ...t, logo: `/img/clubs/${t.id}.webp` }));
}

export async function build(
  rawDir: string,
  dataDir: string,
  imgDir: string,
): Promise<void> {
  const manual = await readManual(rawDir);
  const teams = buildTeams(manual.teams);
  const result = buildPlayers({
    teams: manual.teams,
    snapshots: await readSquadSnapshots(rawDir),
    tmCrawl: await readTmCrawl(rawDir),
    dcaribou: await readDcaribou(rawDir),
    manualPositions: manual.positions,
    manualValues: manual.values,
    manualMapping: manual.mapping,
    imageIds: await readImageIds(join(imgDir, "players")),
  });
  const season = buildSeason(
    result.players,
    await readMinutes(rawDir),
    manual.season,
    result.vMaxEur,
  );

  // Erst alles validieren, dann schreiben: ein Fehler hinterlässt kein halbes data/.
  const prepare = <T>(file: string, schema: z.ZodType<T>, value: T) => {
    const valid = schema.parse(value);
    return () => writeJson(join(dataDir, file), schema, valid);
  };
  const writes = [
    prepare("teams.json", Teams, teams),
    prepare("players.json", Players, result.players),
    prepare("season.json", Season, season),
    prepare("review/mapping.json", MappingReview, result.mappingReview),
    prepare("review/missing-values.json", MissingValues, result.missingValues),
  ];
  for (const write of writes) await write();
}
