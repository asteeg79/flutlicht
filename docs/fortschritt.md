# Fortschritt

Ein Meilenstein gilt als erledigt, wenn seine Abnahmekriterien (KONZEPT.md Abschnitt 13) erfüllt sind und lint, typecheck und test grün laufen.

- [x] M0 · Repo & Werkzeuge
- [x] M1 · core: Schemas & Regeln
- [ ] M2 · Datenerkundung & Scraper-Grundgerüst
- [ ] M3 · Saison-Import
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
