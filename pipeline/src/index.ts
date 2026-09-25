// Einstieg der Pipeline: `build` (raw/ → data/, KONZEPT 6.5) und `fetch-openligadb`.
import { join } from "node:path";
import { build } from "./build";
import { fetchOpenligaSeason } from "./fetch-openligadb";
import { DATA_DIR, RAW_DIR, REPO_ROOT } from "./paths";

const command = process.argv[2] ?? "build";

if (command === "build") {
  await build(RAW_DIR, DATA_DIR, join(REPO_ROOT, "app", "public", "img"));
  console.log("data/ neu berechnet");
} else if (command === "fetch-openligadb") {
  console.log(`geschrieben: ${await fetchOpenligaSeason()}`);
} else {
  console.error(`Unbekannter Befehl: ${command}`);
  process.exit(1);
}
