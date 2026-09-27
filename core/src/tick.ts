// Taktgeber (KONZEPT 9): entscheidet rein und deterministisch, welche Aktionen fällig
// sind. Jede Aktion hat einen Schlüssel und wird höchstens einmal ausgeführt; die App
// führt aus, merkt sich die Schlüssel in system-state und sendet die Pushes.
import { participation } from "./bonus";
import { RULES } from "./config/rules";
import { firstLock } from "./locks";
import { fixtureCounts } from "./matchday";
import { round1 } from "./rounding";
import { scoreLeague, standings } from "./standings";
import { isBreakWindow, rollTransferBank } from "./transfers";
import type { Fixture, MatchdayPoints, Player } from "./schemas/data";
import type { ManagerDoc } from "./schemas/manager";

const HOUR_MS = 60 * 60 * 1000;
const DAILY_FROM_HOUR = 20;

export type PushKind = "reminder" | "daily" | "final";

export type TickAction =
  | { kind: "finalize"; key: string; matchday: number }
  | {
      kind: "push";
      key: string;
      userId: string;
      pref: PushKind;
      title: string;
      body: string;
      url: string;
    };

export interface TickInput {
  now: Date;
  /** Schon ausgeführte Schlüssel aus system-state. */
  done: ReadonlySet<string>;
  managers: readonly ManagerDoc[];
  players: readonly Pick<Player, "id" | "teamId" | "active" | "position">[];
  fixtures: readonly Fixture[];
  points: readonly MatchdayPoints[];
  firstScoredMatchday: number;
}

const berlinDate = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
// formatToParts statt format: „de-DE“ schreibt sonst „20 Uhr“.
const berlinHour = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .find((p) => p.type === "hour")!.value,
  );
const berlinWeekday = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
  }).format(d);

const HAS_DATA = new Set(["provisional", "final", "manual"]);

export function planTick(input: TickInput): TickAction[] {
  const actions: TickAction[] = [];
  const wantsPush = (m: ManagerDoc, pref: PushKind) =>
    m.push !== undefined && m.push.prefs[pref];
  const push = (
    m: ManagerDoc,
    pref: PushKind,
    key: string,
    title: string,
    body: string,
    url: string,
  ) => {
    if (!input.done.has(key) && wantsPush(m, pref)) {
      actions.push({
        kind: "push",
        key,
        userId: m.userId,
        pref,
        title,
        body,
        url,
      });
    }
  };
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const positions = new Map(input.players.map((p) => [p.id, p.position]));
  const finalSet = new Set(
    input.points.filter((p) => p.status === "final").map((p) => p.matchday),
  );
  let current: number | null = null;
  for (let md = 1; md <= RULES.matchdays; md++) {
    if (!finalSet.has(md)) {
      current = md;
      break;
    }
  }

  // Finalisierung aller finalen Spieltage, die noch nicht verbucht sind.
  for (const md of [...finalSet].sort((a, b) => a - b)) {
    const key = `final:${md}`;
    if (!input.done.has(key))
      actions.push({ kind: "finalize", key, matchday: md });
  }

  // Erinnerungen 24 h / 3 h vor der ersten Sperre des aktuellen Spieltags.
  if (current !== null) {
    const fixtures = input.fixtures.filter((f) => f.matchday === current);
    const lock = firstLock(fixtures);
    const until = lock === null ? -1 : lock.getTime() - input.now.getTime();
    const window =
      until > 3 * HOUR_MS && until <= 24 * HOUR_MS
        ? 24
        : until > 0 && until <= 3 * HOUR_MS
          ? 3
          : null;
    if (window !== null) {
      const playing = new Set(
        fixtures
          .filter(fixtureCounts)
          .flatMap((f) => [f.homeTeamId, f.awayTeamId]),
      );
      for (const m of input.managers) {
        const problem =
          m.lineup === null
            ? "du hast noch keinen Kader"
            : current >= m.firstMatchday &&
                m.lineup.starters.some((id) => {
                  const p = byId.get(id);
                  return !p || !p.active || !playing.has(p.teamId);
                })
              ? "deine Aufstellung ist unvollständig"
              : null;
        if (problem === null) continue;
        push(
          m,
          "reminder",
          `remind${window}:${current}:${m.userId}`,
          "Aufstellung prüfen",
          `⏰ Noch ${window} Std. bis zur ersten Sperre an Spieltag ${current} — ${problem}.`,
          m.lineup === null ? "/markt" : "/team",
        );
      }
    }
  }

  // Tagesfazit: alle heutigen Spiele haben Daten, nach 20:00 Uhr (Berlin).
  const today = berlinDate(input.now);
  const todays = input.fixtures.filter(
    (f) => fixtureCounts(f) && berlinDate(new Date(f.kickoffUtc)) === today,
  );
  if (
    todays.length > 0 &&
    berlinHour(input.now) >= DAILY_FROM_HOUR &&
    todays.every((f) => HAS_DATA.has(f.dataState))
  ) {
    const md = todays[0]!.matchday;
    const points = input.points.find((p) => p.matchday === md);
    if (points) {
      const scores = scoreLeague(input.managers, [points], positions);
      const totals = [...scores].flatMap(([id, byMd]) => {
        const s = byMd.get(md);
        return s ? [{ id, total: s.total }] : [];
      });
      for (const m of input.managers) {
        const mine = totals.find((t) => t.id === m.userId);
        if (!mine) continue;
        const place = totals.filter((t) => t.total > mine.total).length + 1;
        const status = points.status === "final" ? "final" : "vorläufig";
        push(
          m,
          "daily",
          `daily:${today}:${m.userId}`,
          `Spieltag ${md}`,
          `📊 ${berlinWeekday(input.now)}: ${mine.total} Punkte (${status}). Du bist ${place}. im Spieltag.`,
          `/spieltag/${md}`,
        );
      }
    }
  }

  // Endergebnis-Push nach der Finalisierung (nur gewertete Spieltage).
  const scored = input.points.filter(
    (p) => p.status === "final" && p.matchday >= input.firstScoredMatchday,
  );
  if (scored.length > 0) {
    const scores = scoreLeague(input.managers, input.points, positions);
    for (const md of scored) {
      const upTo = new Map(
        input.points
          .filter((p) => p.matchday <= md.matchday)
          .map((p) => [p.matchday, p.status]),
      );
      const cut = new Map(
        [...scores].map(([id, byMd]) => [
          id,
          new Map([...byMd].filter(([n]) => n <= md.matchday)),
        ]),
      );
      const table = standings(cut, upTo);
      const winners = (table.winners[md.matchday] ?? [])
        .map(
          (id) =>
            input.managers.find((m) => m.userId === id)?.displayName ?? "?",
        )
        .join(", ");
      const top = Math.max(
        ...[...cut.values()].map((b) => b.get(md.matchday)?.total ?? -Infinity),
      );
      for (const m of input.managers) {
        const mine = cut.get(m.userId)?.get(md.matchday);
        const row = table.rows.find((r) => r.userId === m.userId);
        if (!mine || !row) continue;
        push(
          m,
          "final",
          `finalpush:${md.matchday}:${m.userId}`,
          `Spieltag ${md.matchday} final`,
          `🏁 Spieltag ${md.matchday} final: ${mine.total} Punkte, Platz ${row.rank} gesamt. Spieltagssieger: ${winners} (${top}).`,
          `/spieltag/${md.matchday}`,
        );
      }
    }
  }
  return actions;
}

/**
 * Finalisierung von Spieltag n für einen Manager (KONZEPT 9): Aufstellung einfrieren
 * und die Transferbank bis n fortschreiben. Idempotent: ein schon eingefrorener Stand
 * bleibt, eine schon fortgeschriebene Bank auch.
 */
export function finalizeManager(
  doc: ManagerDoc,
  matchday: number,
  fixtures: readonly Pick<Fixture, "matchday" | "kickoffUtc">[],
  finals: ReadonlyMap<number, Date>,
  /** Spieltagsprämie (2.7), vorab für alle Manager mit `matchdayBonuses` berechnet. */
  bonus?: { firstScoredMatchday: number; bonus: number },
): ManagerDoc {
  const key = String(matchday);
  const kind = bonus
    ? participation(doc, matchday, bonus.firstScoredMatchday)
    : matchday >= doc.firstMatchday
      ? "scored"
      : null;
  // Eingefroren wird, was gewertet wird, und der Schattenbetrieb (zum Nachsehen).
  const lineupHistory =
    doc.lineup && kind !== null && doc.lineupHistory[key] === undefined
      ? { ...doc.lineupHistory, [key]: doc.lineup }
      : doc.lineupHistory;
  // Gutgeschrieben wird nur an gewerteten Spieltagen und nur einmal.
  const credit =
    bonus && kind === "scored" && doc.matchdayBonuses?.[key] === undefined;
  const money = credit
    ? {
        cash: round1(doc.cash + bonus.bonus),
        matchdayBonuses: { ...doc.matchdayBonuses, [key]: bonus.bonus },
      }
    : {};
  let bank = doc.transferBank;
  while (bank.matchday <= matchday) {
    const lock = firstLock(
      fixtures.filter((f) => f.matchday === bank.matchday),
    );
    const unlimited =
      bank.matchday <= doc.firstMatchday ||
      (lock !== null &&
        isBreakWindow(finals.get(bank.matchday - 1) ?? null, lock));
    bank = rollTransferBank(bank, unlimited);
  }
  return { ...doc, ...money, lineupHistory, transferBank: bank };
}
