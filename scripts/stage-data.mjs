// Übernommen aus WM-Tipp scripts/stage-data.mjs, angepasst: Ziel app/generated/data/
// (gitignored, KONZEPT 6.3); die Spieltagsdateien zusätzlich gebündelt als points.json,
// damit game-data.ts alles per statischem import laden kann.
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
console.log(
  `[stage-data] data/ → app/generated/data/ (${files.length} Spieltage)`,
);
