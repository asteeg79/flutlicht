// Pfade im Repo. `build` liest raw/ und schreibt ausschließlich data/;
// `fetch-openligadb` schreibt raw/openligadb/ (läuft in der Action fixtures.yml).
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const RAW_DIR = join(REPO_ROOT, "raw");
export const DATA_DIR = join(REPO_ROOT, "data");
