# Entscheidungen

Getroffene Annahmen und Abweichungen von KONZEPT.md. Neueste Einträge oben.

| Datum | Frage | Entscheidung | Begründung |
|---|---|---|---|
| 2026-09-25 | Tool-Versionen (M0) | Node ≥ 22.12 (CI: Node 22), TypeScript ~5.9, vitest 5, ESLint 10 (Flat Config), Next ^15.5 wie im Konzept | vitest 5 verlangt Node ≥ 22.12; typescript-eslint unterstützt TypeScript nur bis < 6.1, deshalb nicht TS 7. KONZEPT 6.2 nennt Node ≥ 20, Node 22 erfüllt das |
| 2026-09-25 | ESLint-Setup | Eine Root-Flat-Config (WM-Tipp-Muster) für alle Pakete statt `.eslintrc.json` aus Workgrid; ohne sonarjs | Ein Lint-Lauf für das ganze Monorepo; `.eslintrc` wird von ESLint 10 nicht mehr unterstützt; sonarjs ist laut KONZEPT 14 optional |
| 2026-09-25 | Prettier und Markdown | `*.md` und `.vscode/` sind von Prettier ausgenommen | KONZEPT.md und CLAUDE.md sind handgepflegt und sollen nicht umformatiert werden |
| 2026-09-25 | Grundkonzept | siehe KONZEPT.md (Grilling-Runden Q1–Q34 mit Alex) | – |
