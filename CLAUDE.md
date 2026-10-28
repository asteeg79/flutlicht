# CLAUDE.md: Flutlicht

## Projekt
Privater Bundesliga-Fantasy-Manager für eine Freundesrunde. Die **verbindliche
Spezifikation ist `KONZEPT.md`**, die Reihenfolge der Arbeit steht in Abschnitt 13.

## Vor jeder Sitzung
1. `docs/fortschritt.md` lesen: Welcher Meilenstein ist dran?
2. Die für den Meilenstein relevanten Abschnitte in `KONZEPT.md` lesen.
3. `reuse/README.md` lesen und vorhandene Snippets nutzen, bevor du Neues schreibst.

## Projektregeln
- Immer nur **einen** Meilenstein bearbeiten. Er ist fertig, wenn seine Abnahmekriterien
  erfüllt sind und `pnpm lint && pnpm typecheck && pnpm test` grün laufen.
  Danach Commit `feat(Mx): …` und `docs/fortschritt.md` aktualisieren.
- Regeln, Punkte und Preise gehören **ausschließlich** nach `core/` (reine Funktionen,
  keine I/O). App und Pipeline rufen `core` auf und rechnen nie selbst.
- Die Rechenbeispiele aus `KONZEPT.md` 3.5 und 4.x sind Pflicht-Tests und werden
  wörtlich übernommen.
- Nicht geklärte Punkte: sinnvolle Annahme treffen, in `docs/entscheidungen.md`
  festhalten (Datum, Frage, Entscheidung, Begründung), weitermachen. Nur bei nicht
  umkehrbaren Entscheidungen nachfragen.
- Übernommener Code bekommt einen Herkunftskommentar im Dateikopf:
  `// Übernommen aus <Projekt> <Pfad>, angepasst: <was>`.
- UI-Texte, Kommentare und Commits auf Deutsch; Bezeichner auf Englisch.
- Zeiten in UTC speichern, in `Europe/Berlin` anzeigen. Der Server läuft in UTC.
- `data/` schreibt **nur** die Pipeline. `raw/` schreiben nur der Scraper,
  die Actions und die Admin-Commits.
- Keine Secrets im Repo. `.env*` ist gitignored. Die Variablen stehen in `KONZEPT.md` 15.2.
- **Scraping-Regeln (KONZEPT 5.6) sind nicht verhandelbar:** Keine zusätzlichen
  Endpunkte, keine höhere Frequenz, keine Parallelität. Tests machen keine echten Abrufe.
- Neue API-Route: `withUser`/`withAdmin` verwenden **oder** in
  `lib/public-api-paths.ts` begründen. Der Guard-Test muss grün bleiben.

## Sicherheit
- Vertrauensgrenzen, ASVS-L1-Prüfpunkte und bekannte Ausnahmen stehen in
  `security/review-instructions.md`. Sie gelten für jede Änderung; das Claude-Review
  der PRs liest dieselbe Datei.
- `security/inventory.yml` (Runtime, Hosting, Patch-Weg) bei Änderungen an Runtime,
  Hosting oder Deploy-Weg mitpflegen.
- PRs prüft `security-pr-review.yml` (gitleaks, Semgrep, Claude), montags läuft
  `security-weekly-scan.yml` mit ZAP gegen die Live-App.

## Befehle
- `pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck`
- `pnpm --filter pipeline build` rechnet `data/` lokal aus `raw/` neu.
- Scraper: `cd scraper && python -m fm_scraper run <job> [--matchday N]`

## Allgemeine Arbeitsweise

Verhaltensregeln gegen typische Fehler von Sprachmodellen beim Programmieren.
Mit den projektspezifischen Regeln oben zusammen anwenden.

### 1. Erst denken, dann programmieren
**Nichts stillschweigend annehmen. Unklarheiten offenlegen. Zielkonflikte benennen.**
- Annahmen ausdrücklich nennen. Bei Unsicherheit fragen.
- Gibt es mehrere Deutungen, sie vorlegen statt still eine zu wählen.
- Gibt es einen einfacheren Weg, ihn nennen. Wo es angebracht ist, widersprechen.
- Ist etwas unklar: anhalten, benennen, was verwirrt, und fragen.

### 2. Einfachheit zuerst
**So wenig Code wie nötig. Nichts auf Vorrat.**
- Keine Funktionen über die Anforderung hinaus.
- Keine Abstraktionen für Code, der nur einmal gebraucht wird.
- Keine nicht verlangte Flexibilität oder Konfigurierbarkeit.
- Keine Fehlerbehandlung für unmögliche Fälle.
- Wenn 200 Zeilen auch 50 sein könnten: neu schreiben.

### 3. Gezielte Änderungen
**Nur anfassen, was nötig ist. Nur den eigenen Überrest aufräumen.**
- Angrenzenden Code, Kommentare und Formatierung nicht „verbessern“.
- Nichts umbauen, was nicht kaputt ist. Den vorhandenen Stil beibehalten.
- Fremden toten Code erwähnen, nicht löschen.
- Imports, Variablen und Funktionen entfernen, die durch die **eigene** Änderung
  überflüssig wurden.

### 4. Zielgerichtet arbeiten
**Erfolgskriterien festlegen. Wiederholen, bis sie nachweislich erfüllt sind.**
- „Validierung hinzufügen“ → Tests für ungültige Eingaben schreiben, dann grün machen.
- „Fehler beheben“ → Test schreiben, der den Fehler reproduziert, dann grün machen.
- Bei mehrstufigen Aufgaben einen kurzen Plan aufschreiben:
  `1. [Schritt] → prüfen: [Kontrolle]`.
