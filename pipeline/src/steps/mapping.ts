// Zuordnung Sofascore-Spieler ↔ Transfermarkt-ID (KONZEPT 5.4).
// Stufe 1: Name + Geburtsdatum + Verein. Stufe 2: Nachname + Geburtsdatum.
// Alles Unklare kommt in die Review-Liste (data/review/mapping.json).
//
// Der transfermarkt-api-Dienst vertauscht bei Tagen ≤ 12 Tag und Monat
// (Füllkrug 09.02.1993 → "1993-09-02"). Deshalb zählt auch das Datum mit
// vertauschtem Tag/Monat als Treffer; der Name muss trotzdem passen.
import { alnumKey, type MappingReviewEntry } from "@fm/core";

export interface TmCandidate {
  tmId: string;
  name: string;
  lastName: string;
  birthDate: string | undefined;
  tmClubId: string | undefined;
}

export interface MappingSubject {
  playerId: number;
  name: string;
  lastName: string;
  birthDate: string;
  teamId: number;
  tmClubId: string | undefined;
}

export type MappingResult =
  { tmId: string } | { tmId: null; review: MappingReviewEntry | null };

/** Nachname: Sofascore liefert ihn manchmal leer, dann das letzte Wort des Namens. */
export function lastNameOf(name: string, lastName: string | undefined): string {
  return lastName?.trim() || name.trim().split(/\s+/).at(-1) || name;
}

export function mapPlayer(
  s: MappingSubject,
  byBirthDate: ReadonlyMap<string, TmCandidate[]>,
  manual: string | null | undefined,
): MappingResult {
  if (manual !== undefined)
    return manual === null ? { tmId: null, review: null } : { tmId: manual };
  const swapped = swapDayMonth(s.birthDate);
  const sameDob = [
    ...(byBirthDate.get(s.birthDate) ?? []),
    ...(swapped ? (byBirthDate.get(swapped) ?? []) : []),
  ];
  const unique = (list: TmCandidate[]) => [...new Set(list.map((c) => c.tmId))];

  const nameKey = alnumKey(s.name);
  const tokens = tokenKey(s.name);
  const stage1 = unique(
    sameDob.filter(
      (c) =>
        (alnumKey(c.name) === nameKey || tokenKey(c.name) === tokens) &&
        c.tmClubId === s.tmClubId,
    ),
  );
  if (stage1.length === 1) return { tmId: stage1[0]! };

  const lastKey = alnumKey(s.lastName);
  // Leere Schlüssel (z. B. nicht-lateinische Schrift) würden auf alles passen.
  const endsWith = (full: string, last: string) =>
    last !== "" && full.endsWith(last);
  const stage2 = unique(
    sameDob.filter(
      (c) =>
        endsWith(alnumKey(c.name), lastKey) ||
        endsWith(nameKey, alnumKey(c.lastName)),
    ),
  );
  if (stage2.length === 1) return { tmId: stage2[0]! };

  const reason =
    stage1.length > 1 || stage2.length > 1
      ? "ambiguous"
      : sameDob.length > 0
        ? "unmatched"
        : "not-found";
  return {
    tmId: null,
    review: {
      playerId: s.playerId,
      name: s.name,
      teamId: s.teamId,
      birthDate: s.birthDate,
      reason,
      candidates: dedupe(sameDob).map((c) => ({
        tmId: c.tmId,
        name: c.name,
        ...(c.birthDate ? { birthDate: c.birthDate } : {}),
        ...(c.tmClubId ? { tmClubId: c.tmClubId } : {}),
      })),
    },
  };
}

/** "1993-02-09" → "1993-09-02"; null, wenn der Tag > 12 ist oder Tag = Monat. */
export function swapDayMonth(date: string): string | null {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d || Number(d) > 12 || m === d) return null;
  return `${y}-${d}-${m}`;
}

/** Namensteile unabhängig von der Reihenfolge ("Hwang Hee-chan" = "Hee-chan Hwang"). */
function tokenKey(name: string): string {
  return name.split(/\s+/).map(alnumKey).filter(Boolean).sort().join(" ");
}

function dedupe(list: TmCandidate[]): TmCandidate[] {
  return [...new Map(list.map((c) => [c.tmId, c])).values()];
}
