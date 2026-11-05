// Admin-Funktionen (KONZEPT 11). Codes und Konten liegen im Storage; alles, was die
// Fußballwelt ändert, geht als Commit nach raw/manual/ (→ compute.yml rechnet neu).
import { randomInt } from "node:crypto";
import {
  CODE_ALPHABET,
  currentMatchday,
  firstLock,
  firstMatchdayFor,
  ManualMapping,
  ManualMatch,
  ManualPositions,
  ManualSeason,
  ManualValues,
  normalizeCode,
  POSITIONS,
  RULES,
  scraperSilent,
  type Fixture,
  type League,
  type ManagerDoc,
  type ScraperHeartbeat,
  type ScraperStatus,
} from "@fm/core";
import { z } from "zod";
import {
  BadRequest,
  Forbidden,
  NotFound,
  parse,
  Upstream,
} from "@/lib/api-route";
import type { GitHub } from "@/lib/github";
import {
  deleteManager,
  listAllManagers,
  loadEmailIndex,
  loadLeague,
  loadManager,
  saveEmailIndex,
  saveLeague,
  saveManager,
} from "@/lib/storage";

// --- Codes (league.json.enc) ---

function newCode(league: League): string {
  const taken = new Set(
    [...league.invites, ...league.resets].map((c) => c.code),
  );
  for (;;) {
    const code = Array.from(
      { length: 8 },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join("");
    if (!taken.has(code)) return code;
  }
}

export async function createInvite(now: Date): Promise<string> {
  const league = await loadLeague();
  const code = newCode(league);
  await saveLeague({
    ...league,
    invites: [...league.invites, { code, createdAt: now.toISOString() }],
  });
  return code;
}

export async function revokeInvite(raw: unknown): Promise<void> {
  const { code } = parse(z.object({ code: z.string() }), raw);
  const league = await loadLeague();
  const c = normalizeCode(code);
  if (!league.invites.some((i) => i.code === c))
    throw new NotFound("Unbekannter Code");
  await saveLeague({
    ...league,
    invites: league.invites.map((i) =>
      i.code === c ? { ...i, revoked: true } : i,
    ),
  });
}

/** Reset-Code für einen Manager, 24 h gültig, einmalig (KONZEPT 8.3). */
export async function createResetCode(
  raw: unknown,
  now: Date,
): Promise<string> {
  const { userId } = parse(z.object({ userId: z.uuid() }), raw);
  if (!(await loadManager(userId))) throw new NotFound("Konto nicht gefunden");
  const league = await loadLeague();
  const code = newCode(league);
  await saveLeague({
    ...league,
    resets: [...league.resets, { code, userId, createdAt: now.toISOString() }],
  });
  return code;
}

/** Konto vollständig löschen (KONZEPT 15.4); das eigene nicht, sonst sperrt sich der Admin aus. */
export async function deleteAccount(
  raw: unknown,
  adminId: string,
): Promise<void> {
  const { userId } = parse(z.object({ userId: z.uuid() }), raw);
  if (userId === adminId)
    throw new Forbidden("Das eigene Konto kann nicht gelöscht werden.");
  const doc = await loadManager(userId);
  if (!doc) throw new NotFound("Konto nicht gefunden");
  const index = await loadEmailIndex();
  const { [doc.email]: _removed, ...rest } = index;
  await saveEmailIndex(rest);
  await deleteManager(userId);
}

// --- raw/manual/ per GitHub ---

async function updateFile<T>(
  gh: GitHub,
  path: string,
  schema: z.ZodType<T>,
  empty: T,
  mutate: (current: T) => T,
  message: string,
): Promise<void> {
  const current = await gh.getJson<unknown>(path);
  const next = schema.parse(
    mutate(current ? schema.parse(current.data) : empty),
  );
  await gh.putJson(path, next, message, current?.sha);
}

const PlayerId = z.int().positive();
const by = (admin: ManagerDoc) => ` (Admin ${admin.displayName})`;

export const ManualChange = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mapping"),
    playerId: PlayerId,
    tmId: z.string().regex(/^\d+$/).nullable(),
  }),
  z.object({
    kind: z.literal("value"),
    playerId: PlayerId,
    valueEur: z.int().positive(),
  }),
  z.object({
    kind: z.literal("position"),
    playerId: PlayerId,
    position: z.enum(POSITIONS),
  }),
  z.object({
    kind: z.literal("season"),
    firstScoredMatchday: z.int().min(1).max(RULES.matchdays),
    startBudget: z.number().positive().optional(),
  }),
]);

export interface SeasonContext {
  now: Date;
  fixtures: readonly Pick<Fixture, "matchday" | "kickoffUtc">[];
  finals: ReadonlyMap<number, Date>;
  firstScoredMatchday: number;
}

/** Zuordnung, Marktwert, Position oder Saisonstart ändern: je ein Commit nach raw/manual/. */
export async function applyManualChange(
  gh: GitHub,
  raw: unknown,
  admin: ManagerDoc,
  season: SeasonContext,
): Promise<void> {
  const change = parse(ManualChange, raw);
  const key = "playerId" in change ? String(change.playerId) : "";
  switch (change.kind) {
    case "mapping":
      return updateFile(
        gh,
        "raw/manual/mapping.json",
        ManualMapping,
        {},
        (m) => ({ ...m, [key]: change.tmId }),
        `raw(manual): Zuordnung Spieler ${key} → ${change.tmId === null ? "ohne Transfermarkt" : `TM ${change.tmId}`}${by(admin)}`,
      );
    case "value":
      return updateFile(
        gh,
        "raw/manual/values.json",
        ManualValues,
        {},
        (m) => ({ ...m, [key]: change.valueEur }),
        `raw(manual): Marktwert Spieler ${key} = ${change.valueEur} EUR${by(admin)}`,
      );
    case "position":
      return updateFile(
        gh,
        "raw/manual/positions.json",
        ManualPositions,
        {},
        (m) => ({ ...m, [key]: change.position }),
        `raw(manual): Position Spieler ${key} = ${change.position}${by(admin)}`,
      );
    case "season": {
      assertSeasonEditable(season, change.firstScoredMatchday);
      const next = {
        firstScoredMatchday: change.firstScoredMatchday,
        ...(change.startBudget ? { startBudget: change.startBudget } : {}),
      };
      await updateFile(
        gh,
        "raw/manual/season.json",
        ManualSeason,
        next,
        () => next,
        `raw(manual): Saisonstart Spieltag ${change.firstScoredMatchday}${change.startBudget ? `, Startbudget ${change.startBudget} Mio.` : ""}${by(admin)}`,
      );
      return moveManagersToSeasonStart(season, change.firstScoredMatchday);
    }
  }
}

/**
 * Der Startspieltag jedes Kontos hängt am Saisonstart (bei der Registrierung nie davor).
 * Verschiebt der Admin ihn, ziehen alle Konten mit (KONZEPT 2.8), sonst bliebe ein
 * vorgezogener Start wirkungslos. Die Transferbank beginnt dort neu; vor dem ersten
 * gewerteten Spieltag sind alle Transfers unbegrenzt, es geht also nichts verloren.
 */
async function moveManagersToSeasonStart(
  ctx: SeasonContext,
  firstScoredMatchday: number,
): Promise<void> {
  const firstMatchday = firstMatchdayFor(
    ctx.fixtures,
    ctx.finals,
    ctx.now,
    firstScoredMatchday,
  );
  for (const doc of await listAllManagers()) {
    await saveManager({
      ...doc,
      firstMatchday,
      transferBank: {
        matchday: firstMatchday,
        available: RULES.freeTransfersPerMatchday,
      },
      updatedAt: ctx.now.toISOString(),
    });
  }
}

/** Startbudget und ersten Spieltag nur vor dem ersten gewerteten Spieltag ändern (KONZEPT 11). */
function assertSeasonEditable(ctx: SeasonContext, requested: number): void {
  const lockOf = (md: number) =>
    firstLock(ctx.fixtures.filter((f) => f.matchday === md));
  const started = lockOf(ctx.firstScoredMatchday);
  if (started === null || ctx.now >= started) {
    throw new Forbidden(
      "Die Saison läuft schon; Startbudget und erster Spieltag sind fest.",
    );
  }
  const current = currentMatchday(ctx.finals) ?? RULES.matchdays;
  const lock = lockOf(requested);
  if (requested < current || lock === null || ctx.now >= lock) {
    throw new BadRequest(
      `Spieltag ${requested} hat schon begonnen. Wähle einen späteren.`,
    );
  }
}

const MatchInput = ManualMatch.omit({ enteredBy: true, enteredAt: true });

/** Spieldaten von Hand nachtragen → raw/manual/matches/{eventId}.json (KONZEPT 7.4, 11). */
export async function saveManualMatch(
  gh: GitHub,
  raw: unknown,
  admin: ManagerDoc,
  now: Date,
  fixtures: readonly Fixture[],
): Promise<string> {
  const input = parse(MatchInput, raw);
  const fixture = fixtures.find((f) => f.sofascoreEventId === input.eventId);
  if (!fixture)
    throw new NotFound("Zu diesem Event gibt es kein Spiel im Spielplan.");
  const ids = input.players.map((p) => p.playerId);
  if (new Set(ids).size !== ids.length)
    throw new BadRequest("Jeder Spieler darf nur einmal vorkommen.");
  const path = `raw/manual/matches/${input.eventId}.json`;
  const existing = await gh.getJson<unknown>(path);
  const match: ManualMatch = {
    ...input,
    enteredBy: admin.displayName,
    enteredAt: now.toISOString(),
  };
  await gh.putJson(
    path,
    ManualMatch.parse(match),
    `raw(manual): Nachtrag Spiel ${input.eventId} (Spieltag ${fixture.matchday})${by(admin)}`,
    existing?.sha,
  );
  return path;
}

export async function recompute(gh: GitHub): Promise<void> {
  await gh.dispatch("recompute");
}

export interface AdminStatus {
  /** Meldung, wenn GitHub nicht erreichbar oder nicht eingerichtet ist; dann fehlen die drei Läufe. */
  github: string | null;
  scraper: { date: string; message: string } | null;
  /** Letztes Lebenszeichen des Heim-Rechners mit seinem Stand; null, solange er sich nie gemeldet hat. */
  heartbeat: { at: string; silent: boolean; status: ScraperStatus } | null;
  compute: {
    status: string;
    conclusion: string | null;
    createdAt: string;
    url: string;
  } | null;
  fixtures: {
    status: string;
    conclusion: string | null;
    createdAt: string;
    url: string;
  } | null;
  pending: number;
  /** Letzter erledigter Tick-Eintrag. */
  tick: { key: string; at: string } | null;
}

/** Status-Übersicht (KONZEPT 11): Scraper (Commit, Lebenszeichen), letzte Pipeline-Läufe, offene Spiele, Tick. */
export async function adminStatus(
  gh: GitHub,
  fixtures: readonly Fixture[],
  tickDone: Record<string, string>,
  scraper: ScraperHeartbeat | null,
  now: Date,
): Promise<AdminStatus> {
  // Ohne GitHub (etwa fehlender GITHUB_PAT) bleibt der Rest des Status sichtbar.
  let github: Pick<AdminStatus, "github" | "scraper" | "compute" | "fixtures">;
  try {
    const [scraper, compute, fixturesRun] = await Promise.all([
      gh.lastCommit("raw/sofascore"),
      gh.lastRun("compute.yml"),
      gh.lastRun("fixtures.yml"),
    ]);
    github = { github: null, scraper, compute, fixtures: fixturesRun };
  } catch (err) {
    if (!(err instanceof Upstream)) throw err;
    github = {
      github: err.message,
      scraper: null,
      compute: null,
      fixtures: null,
    };
  }
  return {
    ...github,
    heartbeat:
      scraper === null
        ? null
        : {
            at: scraper.seenAt,
            silent: scraperSilent(scraper.seenAt, now),
            status: scraper.status,
          },
    pending: fixtures.filter((f) => f.dataState === "pending").length,
    tick:
      Object.entries(tickDone)
        .map(([key, at]) => ({ key, at }))
        .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null,
  };
}
