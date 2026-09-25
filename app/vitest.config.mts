// Übernommen aus Workgrid vitest.config.ts, angepasst: Projekt „app“ im Root-Lauf, ohne Coverage-Vorgaben.
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // „server-only“ wirft außerhalb von React-Server-Komponenten; im Test ist es bedeutungslos.
      "server-only": path.join(root, "test/server-only-stub.ts"),
    },
  },
  test: {
    name: "app",
    root,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
