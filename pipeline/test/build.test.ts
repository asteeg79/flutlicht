import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/build";

let root: string;
const raw = (p: string) => join(root, "raw", p);
const run = (warn: (m: string) => void = () => {}) =>
  build(join(root, "raw"), join(root, "data"), join(root, "img"), warn);

async function put(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
const envelope = (data: unknown, fetchedAt = "2026-09-25T10:00:00Z") => ({
  fetchedAt,
  url: "u",
  phase: "p",
  data,
});

// 18 Vereine mit je 23 Spielern (IDs teamIndex*100 + 1..23), damit der Sanity-Guard zufrieden ist.
const TEAMS = Array.from({ length: 18 }, (_, i) => ({
  id: 1000 + i,
  name: `Verein ${i}`,
  shortName: `V${i}`,
  openligaTeamId: i,
  tmClubId: String(i),
}));
const POS = ["G", "D", "D", "D", "D", "M", "M", "M", "M", "F", "F"];
const squad = (t: number) =>
  Array.from({ length: 23 }, (_, k) => ({
    player: {
      id: t * 100 + k + 1,
      name: `Spieler ${t}-${k}`,
      shortName: `S${t}-${k}`,
      position: POS[k % POS.length],
      dateOfBirthTimestamp: 946684800,
      proposedMarketValueRaw: { value: (k + 1) * 1_000_000 },
    },
  }));
const lineup = (t: number) =>
  squad(t)
    .slice(0, 11)
    .map((p) => ({
      player: { id: p.player.id, position: p.player.position },
      teamId: 1000 + t,
      substitute: false,
      statistics: { minutesPlayed: 90, rating: 7.0 },
    }));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fm-build-"));
  await put(raw("manual/teams.json"), TEAMS);
  await put(raw("manual/season.json"), { firstScoredMatchday: 1 });
  for (let t = 0; t < 18; t++)
    await put(
      raw(`sofascore/squads/2026-09-25/${1000 + t}.json`),
      envelope({ players: squad(t) }),
    );
  await put(
    raw("openligadb/season-2026.json"),
    envelope(
      [
        {
          matchID: 1,
          matchDateTimeUTC: "2026-09-20T13:30:00Z",
          group: { groupOrderID: 1 },
          team1: { teamId: 0 },
          team2: { teamId: 1 },
          matchIsFinished: true,
          matchResults: [{ resultTypeID: 2, pointsTeam1: 1, pointsTeam2: 0 }],
        },
        {
          matchID: 2,
          matchDateTimeUTC: "2026-10-10T13:30:00Z",
          group: { groupOrderID: 2 },
          team1: { teamId: 2 },
          team2: { teamId: 3 },
          matchIsFinished: false,
          matchResults: [],
        },
      ],
      "2026-09-26T10:00:00Z",
    ),
  );
  await put(
    raw("sofascore/rounds/round-01.json"),
    envelope({
      events: [
        {
          id: 700,
          homeTeam: { id: 1000 },
          awayTeam: { id: 1001 },
          roundInfo: { round: 1 },
        },
      ],
    }),
  );
  await put(
    raw("sofascore/matches/700/final/lineups.json"),
    envelope(
      { home: { players: lineup(0) }, away: { players: lineup(1) } },
      "2026-09-21T08:15:00Z",
    ),
  );
  await put(
    raw("sofascore/matches/700/final/incidents.json"),
    envelope(
      {
        incidents: [
          {
            incidentType: "goal",
            incidentClass: "regular",
            player: { id: 10 },
          },
        ],
      },
      "2026-09-21T08:16:00Z",
    ),
  );
});

const readData = async (file: string) =>
  JSON.parse(await readFile(join(root, "data", file), "utf8"));

describe("pipeline build (raw → data, KONZEPT 6.5)", () => {
  it("schreibt alle Dateien deterministisch", async () => {
    await run();
    const first = await readFile(join(root, "data", "meta.json"), "utf8");

    expect(await readdir(join(root, "data"))).toEqual([
      "fixtures.json",
      "market",
      "meta.json",
      "players.json",
      "points",
      "review",
      "season.json",
      "teams.json",
    ]);
    expect((await readData("players.json")).length).toBe(414);
    expect(
      (await readData("fixtures.json")).map(
        (f: { sofascoreEventId?: number; dataState: string }) => [
          f.sofascoreEventId,
          f.dataState,
        ],
      ),
    ).toEqual([
      [700, "final"],
      [undefined, "none"],
    ]);
    const md1 = await readData("points/md-01.json");
    expect(md1).toMatchObject({
      status: "final",
      generatedAt: "2026-09-21T08:16:00Z",
    });
    expect(md1.players["10"].parts.goals).toBe(5);
    // Erster gewerteter Spieltag 1: Spieler 10 (ST, 90′, Note 7, Tor, zu null nicht für ST) → P = 15, E = 4 → +4.4 %
    const history = await readData("market/history.json");
    expect(history["10"]).toHaveLength(1);
    expect(await readData("meta.json")).toMatchObject({
      generatedAt: "2026-09-26T10:00:00.000Z",
      lastFinalMatchday: 1,
    });

    await run();
    expect(await readFile(join(root, "data", "meta.json"), "utf8")).toBe(first);
  });

  it("löscht Spieltagsdateien, die es nicht mehr gibt", async () => {
    await put(join(root, "data", "points", "md-09.json"), "{}");
    await run();
    expect(await readdir(join(root, "data", "points"))).toEqual(["md-01.json"]);
  });

  it("überspringt Kader-Einträge ohne Geburtsdatum mit Warnung", async () => {
    // Sofascore führt neu gemeldete Nachwuchsspieler zunächst nur mit ID und Namen.
    await put(
      raw("sofascore/squads/2026-10-05/1000.json"),
      envelope({
        players: [
          ...squad(0),
          {
            player: {
              id: 9999,
              name: "Neu Gemeldet",
              shortName: "N. Gemeldet",
            },
          },
        ],
      }),
    );
    const warnings: string[] = [];
    await run((m) => warnings.push(m));

    const players = await readData("players.json");
    expect(players.length).toBe(414);
    expect(players.some((p: { id: number }) => p.id === 9999)).toBe(false);
    expect(warnings).toEqual([
      "Kader 2026-10-05/1000.json: Spieler 9999 (Neu Gemeldet) ohne Geburtsdatum, übersprungen",
    ]);
  });

  it("schreibt nichts bei kaputtem Raw-File", async () => {
    await put(raw("sofascore/matches/700/final/lineups.json"), "{kaputt");
    await expect(run()).rejects.toThrow();
    expect(existsSync(join(root, "data"))).toBe(false);
  });

  it("schreibt nichts, wenn der Sanity-Guard anschlägt", async () => {
    await put(
      raw("sofascore/matches/700/final/lineups.json"),
      envelope({
        home: { players: lineup(0).slice(0, 5) },
        away: { players: lineup(1) },
      }),
    );
    await expect(run()).rejects.toThrow(
      /Sanity-Guard: Spiel 700: nur 16 Spieler/,
    );
    expect(existsSync(join(root, "data"))).toBe(false);
  });
});

describe("Admin-Änderungen über raw/manual/ (Abnahme M10)", () => {
  it("ein manueller Spielnachtrag ergibt Punkte", async () => {
    // Spiel 700 ohne Sofascore-Daten, dafür vom Admin nachgetragen.
    await rm(raw("sofascore/matches/700"), { recursive: true });
    const row = {
      started: true,
      minutes: 90,
      rating: 7.5,
      goals: 1,
      assists: 0,
      ownGoals: 0,
      yellow: false,
      yellowRed: false,
      red: false,
      penMissed: 0,
      penSaved: 0,
    };
    await put(raw("manual/matches/700.json"), {
      eventId: 700,
      enteredBy: "Alex",
      enteredAt: "2026-09-24T08:00:00Z",
      score: { home: 1, away: 0 },
      players: Array.from({ length: 22 }, (_, k) => ({
        ...row,
        playerId: k < 11 ? k + 1 : 100 + k - 10,
        goals: k === 9 ? 1 : 0,
      })),
    });
    await run();
    const fixtures = await readData("fixtures.json");
    expect(fixtures[0]).toMatchObject({
      sofascoreEventId: 700,
      dataState: "manual",
    });
    const md1 = await readData("points/md-01.json");
    expect(md1.status).toBe("final");
    // Spieler 10 (ST): Note 7.5 → 5, Tor 5 → 10
    expect(md1.players["10"]).toMatchObject({ eventId: 700, base: 10 });
  });

  it("ein Mapping-Fix entfernt den Eintrag aus der Review-Liste", async () => {
    await run();
    const before = (await readData("review/mapping.json")).map(
      (m: { playerId: number }) => m.playerId,
    );
    expect(before).toContain(1);
    await put(raw("manual/mapping.json"), { "1": null });
    await run();
    const after = (await readData("review/mapping.json")).map(
      (m: { playerId: number }) => m.playerId,
    );
    expect(after).not.toContain(1);
    expect(after).toHaveLength(before.length - 1);
  });
});
