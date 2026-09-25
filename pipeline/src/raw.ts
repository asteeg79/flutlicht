// Liest raw/ ein (Hülle { fetchedAt, url, phase, data } vom Scraper, KONZEPT 7.2).
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  ManualMapping,
  ManualPositions,
  ManualSeason,
  ManualTeams,
  ManualValues,
  positionFromSofascore,
} from "@fm/core";
import { parseCsv } from "./csv";
import type { SquadSnapshot, ValuedCandidate } from "./steps/players";
import { readJson, readJsonOptional } from "./io/json";

const Envelope = z.object({ data: z.unknown() });

async function readData(path: string): Promise<unknown> {
  return (await readJson(path, Envelope)).data;
}

async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function listJson(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
}

const SofaSquad = z.object({
  players: z.array(
    z.object({
      player: z.object({
        id: z.int(),
        name: z.string(),
        shortName: z.string().optional(),
        lastName: z.string().optional(),
        position: z.string().optional(),
        dateOfBirthTimestamp: z.number(),
        proposedMarketValueRaw: z.object({ value: z.number() }).optional(),
      }),
    }),
  ),
});

export async function readSquadSnapshots(
  rawDir: string,
): Promise<SquadSnapshot[]> {
  const base = join(rawDir, "sofascore", "squads");
  const out: SquadSnapshot[] = [];
  for (const date of await listDirs(base)) {
    for (const file of await listJson(join(base, date))) {
      const data = SofaSquad.parse(await readData(join(base, date, file)));
      out.push({
        date,
        teamId: Number(file.replace(".json", "")),
        players: data.players.map(({ player: p }) => ({
          id: p.id,
          name: p.name,
          shortName: p.shortName || p.name,
          lastName: p.lastName,
          position: positionFromSofascore(p.position),
          birthDate: new Date(p.dateOfBirthTimestamp * 1000)
            .toISOString()
            .slice(0, 10),
          sofascoreValueEur: p.proposedMarketValueRaw?.value,
        })),
      });
    }
  }
  return out;
}

const TmClub = z.object({
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      dateOfBirth: z.string().optional(),
      marketValue: z.number().optional(),
    }),
  ),
});

/** Frühester vollständiger Crawl (Saisonstart); leer, wenn es keinen gibt. */
export async function readTmCrawl(rawDir: string): Promise<ValuedCandidate[]> {
  const base = join(rawDir, "transfermarkt");
  const date = (await listDirs(base)).find((d) =>
    existsSync(join(base, d, "clubs.json")),
  );
  if (!date) return [];
  const out: ValuedCandidate[] = [];
  for (const file of await listJson(join(base, date))) {
    const match = /^club-(\d+)\.json$/.exec(file);
    if (!match) continue;
    const club = TmClub.parse(await readData(join(base, date, file)));
    for (const p of club.players) {
      out.push({
        tmId: p.id,
        name: p.name,
        lastName: p.name.split(/\s+/).at(-1) ?? p.name,
        birthDate: p.dateOfBirth?.slice(0, 10),
        tmClubId: match[1],
        valueEur: p.marketValue,
      });
    }
  }
  return out;
}

export async function readDcaribou(rawDir: string): Promise<ValuedCandidate[]> {
  const path = join(rawDir, "dcaribou", "players-L1.csv");
  if (!existsSync(path)) return [];
  return parseCsv(await readFile(path, "utf8")).map((r) => ({
    tmId: r.player_id!,
    name: r.name!,
    lastName: r.last_name || r.name!,
    birthDate: r.date_of_birth ? r.date_of_birth.slice(0, 10) : undefined,
    tmClubId: r.current_club_id || undefined,
    valueEur: Number(r.market_value_in_eur) || undefined,
  }));
}

const SofaLineups = z.object({
  home: z.object({ players: z.array(z.unknown()) }),
  away: z.object({ players: z.array(z.unknown()) }),
});
const LineupMinutes = z.object({
  player: z.object({ id: z.int() }),
  statistics: z.object({ minutesPlayed: z.number().optional() }).optional(),
});

/** Einsatzminuten je Spieler aus allen finalen Aufstellungen (Backfill). */
export async function readMinutes(
  rawDir: string,
): Promise<Map<number, number>> {
  const base = join(rawDir, "sofascore", "matches");
  const minutes = new Map<number, number>();
  for (const event of await listDirs(base)) {
    const path = join(base, event, "final", "lineups.json");
    if (!existsSync(path)) continue;
    const lineups = SofaLineups.parse(await readData(path));
    for (const raw of [...lineups.home.players, ...lineups.away.players]) {
      const p = LineupMinutes.parse(raw);
      const m = p.statistics?.minutesPlayed ?? 0;
      minutes.set(p.player.id, (minutes.get(p.player.id) ?? 0) + m);
    }
  }
  return minutes;
}

export async function readManual(rawDir: string) {
  const dir = join(rawDir, "manual");
  return {
    teams: await readJson(join(dir, "teams.json"), ManualTeams),
    season: await readJson(join(dir, "season.json"), ManualSeason),
    positions:
      (await readJsonOptional(join(dir, "positions.json"), ManualPositions)) ??
      {},
    values:
      (await readJsonOptional(join(dir, "values.json"), ManualValues)) ?? {},
    mapping:
      (await readJsonOptional(join(dir, "mapping.json"), ManualMapping)) ?? {},
  };
}

export async function readImageIds(imgDir: string): Promise<Set<number>> {
  if (!existsSync(imgDir)) return new Set();
  const files = await readdir(imgDir);
  return new Set(
    files.filter((f) => f.endsWith(".webp")).map((f) => Number(f.slice(0, -5))),
  );
}
