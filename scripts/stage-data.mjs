// Übernommen aus WM-Tipp scripts/stage-data.mjs, angepasst: Ziel app/generated/data/
// (gitignored, KONZEPT 6.3); die Spieltagsdateien zusätzlich gebündelt als points.json,
// damit game-data.ts alles per statischem import laden kann.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openTransferWindow } from "./e2e-window.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "data");
const dest = join(root, "app", "generated", "data");

if (!existsSync(src)) {
  console.error(`[stage-data] data/ fehlt (${src}).`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });

const pointsDir = join(src, "points");
const files = existsSync(pointsDir)
  ? (await readdir(pointsDir)).filter((f) => f.endsWith(".json")).sort()
  : [];
const points = await Promise.all(
  files.map(async (f) =>
    JSON.parse(await readFile(join(pointsDir, f), "utf8")),
  ),
);
await writeFile(join(dest, "points.json"), JSON.stringify(points));

// Nur für die E2E-Tests: Transferfenster offen halten (scripts/e2e-window.mjs).
if (process.env.FM_E2E_TRANSFER_WINDOW === "open") {
  const fixturesFile = join(dest, "fixtures.json");
  const finalMatchdays = new Set(
    points.filter((p) => p.status === "final").map((p) => p.matchday),
  );
  const { fixtures, matchday, shiftMs } = openTransferWindow(
    JSON.parse(await readFile(fixturesFile, "utf8")),
    finalMatchdays,
    new Date(),
  );
  if (shiftMs > 0) {
    await writeFile(fixturesFile, JSON.stringify(fixtures, null, 2) + "\n");
    console.log(
      `[stage-data] E2E: Spieltag ${matchday} und folgende um ${Math.round(shiftMs / 3_600_000)} h verschoben, Transferfenster offen`,
    );
  }
}
console.log(
  `[stage-data] data/ → app/generated/data/ (${files.length} Spieltage)`,
);
