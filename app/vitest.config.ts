// Übernommen aus Workgrid vitest.config.ts, angepasst: Projekt „app“ im Root-Lauf, ohne Coverage-Vorgaben.
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // „server-only“ wirft außerhalb von React-Server-Komponenten; im Test ist es bedeutungslos.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    name: "app",
    root: __dirname,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
