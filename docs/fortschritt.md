# Fortschritt

Ein Meilenstein gilt als erledigt, wenn seine Abnahmekriterien (KONZEPT.md Abschnitt 13) erfüllt sind und lint, typecheck und test grün laufen.

- [x] M0 · Repo & Werkzeuge
- [x] M1 · core: Schemas & Regeln
- [x] M2 · Datenerkundung & Scraper-Grundgerüst
- [x] M3 · Saison-Import
- [ ] M4 · Pipeline-Automatisierung
- [ ] M5 · App-Grundgerüst & Login
- [ ] M6 · Kader & Markt
- [ ] M7 · Aufstellung & Sperren
- [ ] M8 · Punkte, Spieltag, Tabelle
- [ ] M9 · Push & Taktgeber
- [ ] M10 · Admin
- [ ] M11 · Heim-Rechner-Betrieb & Go-live

## Notizen

- 2026-09-25 M0: Monorepo `app`/`core`/`pipeline`, Root-Tooling aus WM-Tipp, `ci.yml`, `_alert.yml`. Lokal laufen lint, typecheck (alle drei Pakete) und test grün. Privates Repo `asteeg79/fussballmanager`, erster CI-Lauf grün (Run 36144224716).
- 2026-09-25 M1: zod-Schemas (7.1, 7.3, 7.4), Konfigurationen `scoring`/`market`/`rules` und reine Regelfunktionen in `core/`. Alle Rechenbeispiele aus 3.5, 4.1, 4.2 und 4.3 stehen wörtlich als Tests drin. 115 Tests, Coverage `core` 99,6 % Statements / 98 % Branches. Annahmen stehen in `entscheidungen.md`. Nächster Schritt: M2 (Sofascore-Erkundung, braucht echte Abrufe).
- 2026-09-25 M2: `scraper/` mit Client (Pacing 8–20 s, request→browser, 6-h-Pause, Nachtruhe), `gitsync`, CLI und den Jobs `round-events` und `match-final`, 20 pytest-Tests. 22 echte Abrufe (Spieltag 1, 1 Kader, 2 Bilder), alles im request-Modus. Felder in `docs/sofascore-felder.md`, Adapter `readSofascoreMatch` in `core`. Das Fixture-Spiel Union–Frankfurt 3:3 rechnet komplett durch, 4 Spieler von Hand nachgerechnet. Offen für M3: `yellowRed` und verwandelte Elfmeter im Backfill bestätigen.
- 2026-09-25 M3: Scraper-Jobs `squads`, `dcaribou`, `tm-crawl`, `backfill`, `images`; Pipeline `build` mit den Schritten teams, players, season, review und `fetch:openligadb`. Import: 18 Kader (520 Spieler), dcaribou, eigener TM-Crawl, OpenLigaDB-Spielplan, Backfill Spieltage 1–2. Vereinszuordnung von Alex bestätigt, gewertet wird ab Spieltag 8. **Offen:** Backfill Spieltage 3 und 4 (je ein `backfill`-Aufruf an den nächsten Tagen), `images` (höchstens 60 pro Stunde, über mehrere Tage), Review-Liste der Zuordnungen durch den Admin (M10).
