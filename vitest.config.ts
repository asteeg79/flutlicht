// Übernommen aus WM-Tipp vitest.config.ts, angepasst: Projekte core+pipeline und app,
// Tests liegen in `<paket>/test/**` bzw. neben den App-Modulen.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core+pipeline",
          environment: "node",
          include: ["core/test/**/*.test.ts", "pipeline/test/**/*.test.ts"],
        },
      },
      "app/vitest.config.mts",
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/*.test.mjs"],
        },
      },
      {
        test: {
          name: "security",
          environment: "node",
          include: [".github/scripts/*.test.mjs"],
        },
      },
    ],
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
