// Übernommen aus WM-Tipp vitest.config.ts, angepasst: Pakete core/pipeline/app,
// Tests liegen in `<paket>/test/**` (außerhalb von `src/`).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["core/test/**/*.test.ts", "pipeline/test/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text-summary"],
      include: ["core/src/**/*.ts"],
      // KONZEPT M1: core ist zu ≥ 95 % getestet.
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
