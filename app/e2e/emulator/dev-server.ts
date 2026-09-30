// Dev-Server für die Emulatoren (docs/mobil-testen.md): dieselben Testdaten und
// Einstellungen wie die E2E-Tests (playwright.config.ts), damit das Konto
// admin@e2e.test mit Kader existiert. Vorher einmal `pnpm test:e2e` laufen lassen.
import { spawn } from "node:child_process";
import { testEnv } from "../../playwright.config";

const child = spawn(
  "sh",
  ["-c", `node ../scripts/stage-data.mjs && next dev -p ${testEnv.PORT}`],
  { stdio: "inherit", env: { ...process.env, ...testEnv } },
);
child.on("exit", (code) => process.exit(code ?? 0));
