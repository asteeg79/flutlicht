// Pipeline-Schritt players (KONZEPT 6.5 Schritt 2): Kader + Positionen + Marktwerte → Startpreise.
import {
  chooseStartValue,
  startPrice,
  type MappingReviewEntry,
  type MissingValueEntry,
  type Player,
  type Position,
  type ValueSourceName,
} from "@fm/core";
import { lastNameOf, mapPlayer, type TmCandidate } from "./mapping";

export interface SquadPlayer {
  id: number;
  name: string;
  shortName: string;
  lastName: string | undefined;
  /** Aus dem Sofascore-Code G/D/M/F; undefined, wenn unbekannt. */
  position: Position | undefined;
  birthDate: string;
  sofascoreValueEur: number | undefined;
}

/** Kader eines Vereins an einem Tag (raw/sofascore/squads/{date}/{teamId}.json). */
export interface SquadSnapshot {
  date: string;
  teamId: number;
  players: SquadPlayer[];
}

export interface ValuedCandidate extends TmCandidate {
  valueEur: number | undefined;
}

export interface PlayersInput {
  teams: readonly { id: number; tmClubId?: string | undefined }[];
  snapshots: readonly SquadSnapshot[];
  /** Eigener Crawl zu Saisonstart (frühester Crawl). */
  tmCrawl: readonly ValuedCandidate[];
  dcaribou: readonly ValuedCandidate[];
  manualPositions: Readonly<Record<string, Position>>;
  manualValues: Readonly<Record<string, number>>;
  manualMapping: Readonly<Record<string, string | null>>;
  /** Spieler-IDs mit Bild in app/public/img/players/ */
  imageIds: ReadonlySet<number>;
}

export interface PlayersOutput {
  players: Player[];
  vMaxEur: number;
  mappingReview: MappingReviewEntry[];
  missingValues: MissingValueEntry[];
}

/** Platzhalterpreis für Spieler ohne Marktwert (nicht kaufbar, KONZEPT 4.1). */
const MISSING_PRICE = 0.5;

export function buildPlayers(input: PlayersInput): PlayersOutput {
  const tmClubOf = new Map(input.teams.map((t) => [t.id, t.tmClubId]));
  const snapshots = [...input.snapshots].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // Aktiv ist, wer im jeweils neuesten Kader seines Vereins steht.
  const latestDate = new Map<number, string>();
  for (const s of snapshots) latestDate.set(s.teamId, s.date);
  const first = new Map<number, SquadPlayer>();
  const last = new Map<number, { player: SquadPlayer; teamId: number }>();
  const firstSnapshotDate = snapshots[0]?.date;
  const importIds = new Set<number>();
  const active = new Set<number>();
  for (const s of snapshots) {
    for (const p of s.players) {
      if (!first.has(p.id)) first.set(p.id, p);
      last.set(p.id, { player: p, teamId: s.teamId });
      if (s.date === latestDate.get(s.teamId)) active.add(p.id);
      if (s.date === firstSnapshotDate) importIds.add(p.id);
    }
  }

  const byBirthDate = new Map<string, TmCandidate[]>();
  for (const c of [...input.tmCrawl, ...input.dcaribou]) {
    if (c.birthDate)
      byBirthDate.set(c.birthDate, [
        ...(byBirthDate.get(c.birthDate) ?? []),
        c,
      ]);
  }
  const tmValue = valueIndex(input.tmCrawl);
  const dcValue = valueIndex(input.dcaribou);

  const mappingReview: MappingReviewEntry[] = [];
  const valued: {
    base: Omit<Player, "price" | "purchasable" | "valueSource">;
    value: { valueEur: number; source: ValueSourceName } | null;
  }[] = [];

  for (const [id, { player, teamId }] of [...last].sort(([a], [b]) => a - b)) {
    const key = String(id);
    const position = input.manualPositions[key] ?? first.get(id)!.position;
    if (position === undefined)
      throw new Error(`Spieler ${id} (${player.name}) ohne Position`);
    const mapped = mapPlayer(
      {
        playerId: id,
        name: player.name,
        lastName: lastNameOf(player.name, player.lastName),
        birthDate: player.birthDate,
        teamId,
        tmClubId: tmClubOf.get(teamId),
      },
      byBirthDate,
      input.manualMapping[key],
    );
    if (mapped.tmId === null && mapped.review)
      mappingReview.push(mapped.review);
    const tmId = mapped.tmId ?? undefined;
    const value = chooseStartValue({
      manual: input.manualValues[key],
      "tm-crawl": tmId === undefined ? undefined : tmValue.get(tmId),
      dcaribou: tmId === undefined ? undefined : dcValue.get(tmId),
      sofascore: first.get(id)!.sofascoreValueEur ?? player.sofascoreValueEur,
    });
    valued.push({
      base: {
        id,
        name: player.name,
        shortName: player.shortName,
        teamId,
        position,
        birthDate: player.birthDate,
        ...(tmId ? { tmId } : {}),
        ...(value ? { startValueEur: value.valueEur } : {}),
        active: active.has(id),
        ...(input.imageIds.has(id) ? { image: `/img/players/${id}.webp` } : {}),
      },
      value,
    });
  }

  // vMax wird beim Saison-Import eingefroren: nur Spieler aus dem ersten Kader-Stand zählen.
  const importValues = valued
    .filter((v) => importIds.has(v.base.id) && v.value)
    .map((v) => v.value!.valueEur);
  if (importValues.length === 0)
    throw new Error("Kein Spieler mit Marktwert im ersten Kader-Stand");
  const vMaxEur = Math.max(...importValues);
  const missingValues: MissingValueEntry[] = [];
  const players = valued.map(({ base, value }): Player => {
    if (!value) {
      missingValues.push({
        playerId: base.id,
        name: base.name,
        teamId: base.teamId,
        position: base.position,
      });
      return {
        ...base,
        valueSource: "missing",
        price: MISSING_PRICE,
        purchasable: false,
      };
    }
    return {
      ...base,
      valueSource: value.source,
      price: startPrice(value.valueEur, vMaxEur),
      purchasable: base.active,
    };
  });
  return { players, vMaxEur, mappingReview, missingValues };
}

function valueIndex(list: readonly ValuedCandidate[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of list)
    if (c.valueEur !== undefined) out.set(c.tmId, c.valueEur);
  return out;
}
