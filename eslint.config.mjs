// Übernommen aus WM-Tipp eslint.config.mjs, angepasst: Pakete app/core/pipeline,
// sonarjs weggelassen (laut KONZEPT 14 optional), reuse/ und raw/ ignoriert.
// - typescript-eslint "recommended" (ohne typgeprüfte Regeln → schnell & ruhig)
// - React-Hooks-Regeln nur für die App
// - eslint-config-prettier zuletzt: deaktiviert Stilregeln, die Prettier abdeckt
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.next/**",
      "raw/**",
      "data/**",
      "reuse/**",
      "scraper/**",
      "app/generated/**",
      "app/public/**",
      "app/next-env.d.ts",
      // Cloudflare-Worker: eigene Runtime-Globals, wird separat via wrangler deployt.
      "infra/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // _-präfigierte Argumente/Variablen sind bewusst ungenutzt.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ["pipeline/**/*.ts", "scripts/**/*.mjs", "*.config.{ts,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
