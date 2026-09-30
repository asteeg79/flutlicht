// Anleitung: Kapitel, URL-Parameter und das Rechenbeispiel. Der Text steht in
// components/guide/guide-content.tsx, geöffnet wird der Dialog über ?anleitung=<kapitel>.
import { playerMatchPoints, SCORING } from "@fm/core";

export const GUIDE_PARAM = "anleitung";

export const GUIDE_CHAPTERS = [
  { id: "idee", title: "Die Idee" },
  { id: "start", title: "Startklar" },
  { id: "aufstellung", title: "Aufstellung" },
  { id: "fixiert", title: "Fixiert" },
  { id: "punkte", title: "Punkte" },
  { id: "transfers", title: "Markt & Transfers" },
  { id: "woche", title: "Deine Woche" },
  { id: "tabelle", title: "Tabelle" },
  { id: "wissen", title: "Gut zu wissen" },
] as const;

export type GuideChapterId = (typeof GUIDE_CHAPTERS)[number]["id"];

/** Wert von ?anleitung → Kapitel; leer oder unbekannt → erstes Kapitel, fehlt → zu. */
export function chapterFromParam(value: string | null): GuideChapterId | null {
  if (value === null) return null;
  return GUIDE_CHAPTERS.find((c) => c.id === value)?.id ?? GUIDE_CHAPTERS[0].id;
}

/** Aktuelle URL mit (Kapitel) bzw. ohne (null) Anleitung; andere Parameter bleiben. */
export function guideUrl(
  pathname: string,
  search: string,
  chapter: GuideChapterId | null,
): string {
  const params = new URLSearchParams(search);
  if (chapter === null) params.delete(GUIDE_PARAM);
  else params.set(GUIDE_PARAM, chapter);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Nächstes Kapitel für „Weiter“, am Ende null. */
export function nextChapter(id: GuideChapterId) {
  const i = GUIDE_CHAPTERS.findIndex((c) => c.id === id);
  return GUIDE_CHAPTERS[i + 1] ?? null;
}

/**
 * Rechenbeispiel (KONZEPT 3.5 A): Stürmer, 90 Min., Note 7,8, Tor, Vorlage, Gelb,
 * Startelf. Gerechnet von core, damit der Text nach einer Kalibrierung stimmt.
 */
export function strikerExample() {
  const { parts, base } = playerMatchPoints({
    position: "FWD",
    minutes: 90,
    started: true,
    rating: 7.8,
    goals: 1,
    assists: 1,
    ownGoals: 0,
    yellow: true,
    yellowRed: false,
    red: false,
    penMissed: 0,
    penSaved: 0,
    teamConceded: 1,
  });
  const total = base + SCORING.startBonus;
  return {
    rating: parts.rating,
    goal: parts.goals,
    assist: parts.assists,
    yellow: parts.cards,
    startBonus: SCORING.startBonus,
    total,
    captain: total * SCORING.captainMultiplier,
  };
}
