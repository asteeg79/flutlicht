import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Fokus auf testbare Logik (lib + store); UI/Komponenten via E2E abgedeckt.
      include: ["lib/**/*.ts", "store/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "lib/types.ts",
        "lib/ai-types.ts",
        "lib/domain/fixtures.ts",
        "store/sync-fake.ts",
      ],
    },
  },
});
