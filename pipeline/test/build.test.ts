import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/build";

let root: string;
const raw = (p: string) => join(root, "raw", p);

async function put(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
const envelope = (data: unknown) => ({
  fetchedAt: "2026-09-25T10:00:00Z",
  url: "u",
  phase: "p",
  data,
});
const squadPlayer = (id: number, position: string, value?: number) => ({
  player: {
    id,
    name: `Spieler ${id}`,
    shortName: `S. ${id}`,
    position,
    dateOfBirthTimestamp: 946684800, // 2000-01-01
    ...(value ? { proposedMarketValueRaw: { value, currency: "EUR" } } : {}),
  },
});
const teams = Array.from({ length: 18 }, (_, i) => ({
  id: 1000 + i,
  name: `Verein ${i}`,
  shortName: `V${i}`,
  openligaTeamId: i,
  tmClubId: String(i),
}));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fm-build-"));
  await put(raw("manual/teams.json"), teams);
  await put(raw("manual/season.json"), { firstScoredMatchday: 8 });
  await put(
    raw("sofascore/squads/2026-09-25/1000.json"),
    envelope({
      players: [squadPlayer(1, "G", 4_000_000), squadPlayer(2, "F")],
    }),
  );
  await put(
    raw("sofascore/squads/2026-09-25/1001.json"),
    envelope({ players: [squadPlayer(3, "D", 16_000_000)] }),
  );
  await put(
    raw("dcaribou/players-L1.csv"),
    "player_id,name,last_name,date_of_birth,current_club_id,market_value_in_eur\n55,Spieler 2,2,2000-01-01 00:00:00,0,9000000\n",
  );
  await put(
    raw("sofascore/matches/9/final/lineups.json"),
    envelope({
      home: {
        players: [
          { player: { id: 1 }, statistics: { minutesPlayed: 90 } },
          { player: { id: 2 } },
        ],
      },
      away: {
        players: [{ player: { id: 3 }, statistics: { minutesPlayed: 45 } }],
      },
    }),
  );
});

const readData = async (file: string) =>
  JSON.parse(await readFile(join(root, "data", file), "utf8"));

describe("pipeline build (raw → data, KONZEPT 6.5)", () => {
  it("schreibt teams, players, season und review deterministisch", async () => {
    await build(join(root, "raw"), join(root, "data"), join(root, "img"));
    const first = await readFile(join(root, "data", "players.json"), "utf8");

    expect((await readData("teams.json"))[0]).toEqual({
      ...teams[0],
      logo: "/img/clubs/1000.webp",
    });
    expect(
      (await readData("players.json")).map(
        (p: {
          id: number;
          valueSource: string;
          price: number;
          tmId?: string;
        }) => [p.id, p.valueSource, p.price, p.tmId],
      ),
    ).toEqual([
      [1, "sofascore", 12.5, undefined],
      [2, "dcaribou", 18.8, "55"],
      [3, "sofascore", 25, undefined],
    ]);
    expect(await readData("season.json")).toMatchObject({
      vMaxEur: 16_000_000,
      firstScoredMatchday: 8,
    });
    expect(
      (await readData("review/mapping.json")).map(
        (m: { playerId: number }) => m.playerId,
      ),
    ).toEqual([1, 3]);
    expect(await readData("review/missing-values.json")).toEqual([]);

    await build(join(root, "raw"), join(root, "data"), join(root, "img"));
    expect(await readFile(join(root, "data", "players.json"), "utf8")).toBe(
      first,
    );
  });

  it("schreibt bei einem Fehler nichts", async () => {
    await put(raw("manual/teams.json"), teams.slice(1));
    await expect(
      build(join(root, "raw"), join(root, "data"), join(root, "img")),
    ).rejects.toThrow();
    expect(existsSync(join(root, "data"))).toBe(false);
  });
});
