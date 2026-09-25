// Einstieg der Pipeline: `build` (raw/ → data/, KONZEPT 6.5), `fetch-openligadb`, `check-overdue`.
import { join } from "node:path";
import { Fixtures } from "@fm/core";
import { build } from "./build";
import { overdueFixtures } from "./check-overdue";
import { fetchOpenligaSeason } from "./fetch-openligadb";
import { readJson } from "./io/json";
import { DATA_DIR, RAW_DIR, REPO_ROOT } from "./paths";

const command = process.argv[2] ?? "build";

if (command === "build") {
  await build(RAW_DIR, DATA_DIR, join(REPO_ROOT, "app", "public", "img"));
  console.log("data/ neu berechnet");
} else if (command === "fetch-openligadb") {
  console.log(`geschrieben: ${await fetchOpenligaSeason()}`);
} else if (command === "check-overdue") {
  const overdue = overdueFixtures(
    await readJson(join(DATA_DIR, "fixtures.json"), Fixtures),
    new Date(),
  );
  for (const f of overdue) {
    console.log(
      `::error::Scraper überfällig: Spieltag ${f.matchday}, Spiel ${f.openligaMatchId} (Anpfiff ${f.kickoffUtc}) ohne Daten`,
    );
  }
  if (overdue.length > 0) process.exit(1);
  console.log("Keine überfälligen Spiele");
} else {
  console.error(`Unbekannter Befehl: ${command}`);
  process.exit(1);
}
