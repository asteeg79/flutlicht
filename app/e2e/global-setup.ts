import { rmSync } from "node:fs";
import { join } from "node:path";
import { testEnv } from "../playwright.config";

/** Jeder Lauf beginnt mit leerem lokalem Storage. */
export default function globalSetup() {
  rmSync(join(__dirname, "..", testEnv.FM_LOCAL_DATA_DIR), {
    recursive: true,
    force: true,
  });
}
