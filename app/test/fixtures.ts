// Gemeinsame Testdaten der App: kleiner Markt, gültiger Kader, Manager-Dokument im lokalen Storage.
import { defaultLineup, type ManagerDoc, type Player } from "@fm/core";
import { saveManager } from "@/lib/storage";

/**
 * Markt: TW 1–3, ABW 11–17, MF 21–27, ST 31–35.
 * Vereine so verteilt, dass der Standardkader höchstens 3 je Verein hat.
 */
export const P = (
  id: number,
  position: Player["position"],
  teamId: number,
  price: number,
  over: Partial<Player> = {},
): Player => ({
  id,
  name: `Spieler ${id}`,
  shortName: `S${id}`,
  teamId,
  position,
  birthDate: "2000-01-01",
  valueSource: "tm-crawl",
  price,
  purchasable: true,
  active: true,
  ...over,
});
export const players: Player[] = [
  P(1, "GK", 1, 4),
  P(2, "GK", 2, 4),
  P(3, "GK", 3, 1),
  P(11, "DEF", 3, 5),
  P(12, "DEF", 4, 5),
  P(13, "DEF", 5, 5),
  P(14, "DEF", 6, 5),
  P(15, "DEF", 1, 5),
  P(16, "DEF", 1, 5),
  P(17, "DEF", 1, 5),
  P(21, "MID", 2, 6),
  P(22, "MID", 3, 6),
  P(23, "MID", 4, 6),
  P(24, "MID", 5, 6),
  P(25, "MID", 6, 6),
  P(26, "MID", 1, 6),
  P(27, "MID", 9, 1, { purchasable: false }),
  P(31, "FWD", 2, 7),
  P(32, "FWD", 3, 7),
  P(33, "FWD", 4, 7),
  P(34, "FWD", 1, 7),
  P(35, "FWD", 7, 30),
];
// 2×4 + 5×5 + 5×6 + 3×7 = 84 Mio. bei 85 Mio. Budget
export const SQUAD = [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33];

export const finalsUntil = (last: number, lastAt: string) =>
  new Map(
    Array.from({ length: last }, (_, i) => [
      i + 1,
      new Date(i + 1 === last ? lastAt : "2026-09-01T07:00:00Z"),
    ]),
  );

export const UPDATED = "2026-10-01T10:00:00.000Z";
export async function saveDoc(
  over: Partial<ManagerDoc> = {},
): Promise<ManagerDoc> {
  const doc: ManagerDoc = {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "tom@example.org",
    displayName: "Tom",
    teamName: "Flutlicht FC",
    passwordHash: "scrypt$x",
    role: "player",
    createdAt: UPDATED,
    updatedAt: UPDATED,
    firstMatchday: 8,
    squad: [],
    cash: 85,
    lineup: null,
    lineupHistory: {},
    transfers: [],
    transferBank: { matchday: 8, available: 2 },
    ...over,
  };
  await saveManager(doc);
  return doc;
}

/** Manager mit fertigem Kader, Fenster zu Spieltag 9 (gezählte Transfers). */
export async function withSquad(squad = SQUAD, over: Partial<ManagerDoc> = {}) {
  const picked = squad.map((id) => players.find((p) => p.id === id)!);
  return saveDoc({
    squad,
    cash: 1,
    lineup: defaultLineup(picked),
    transferBank: { matchday: 9, available: 2 },
    ...over,
  });
}
