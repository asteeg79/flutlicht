# Redesign „Arena“: Abnahme

Stand 30.09.2026, Branch `arena` (Phasen 1–8, siehe `docs/arena-plan.md`).
Geprüft mit `pnpm lint`, `pnpm typecheck`, `pnpm test` (445 Tests), `pnpm format:check`,
`pnpm build` und `pnpm --filter @fm/app test:e2e` (11 Tests, Pixel 7), alle grün.

## Checkliste (README Abschnitt 10)

| Kriterium | Ergebnis | Nachweis |
|---|---|---|
| Hell, dunkel und System schalten ohne Neuladen um, die Wahl bleibt nach dem Neuladen, kein falsches Theme blitzt auf | erfüllt | E2E „Darstellung …“; Inline-Script im `<head>` setzt `data-theme` vor dem ersten Paint (`lib/theme.test.ts`) |
| Mobil: Kopf höchstens ca. 190 px; kompakte Leiste nach 120 px, ganz oben wieder weg | erfüllt, zwei Ausnahmen wie im Entwurf | Gemessen bei 390 px: Team 161, Markt 177, Tabelle 170, Historie 175, Optionen 98, Spieler 203 (Entwurf ≈ 196), Spieltag-Vorschau 241 (Entwurf ≈ 238). Leiste auf allen scrollbaren Seiten bei 130 px sichtbar, oben verborgen |
| Team: Tausch nur zwischen gültigen Partnern, Partner hervorgehoben, andere gedimmt; Fixierte unbeweglich und **nicht** ausgegraut | erfüllt (mit core-Regel) | Gültige Partner fragt die Seite bei `core/swapPlayers` ab (`swap-partners.test.ts`); das erlaubt auch Tausche über Positionen, wenn die Formation erlaubt bleibt. Fixierte behalten ihre Farben, nur Schloss und „fixiert“ |
| Jede Änderung zeigt die Speichern-Pille; Fehler → roter Toast und Rücksprung | erfüllt | `SavePill` in Team und Markt; E2E wartet auf ihr Verschwinden |
| Markt: „Holen“ bei jedem Spieler außerhalb des Kaders; Abgabe nur gleiche Position mit Sperrgründen; Bestätigen → „Deal!“ → Chips und Guthaben animiert | erfüllt | E2E „Holen: …“; Sperrgründe aus `transferViolation` (`market-logic.test.ts`) |
| Mehr Transfers als frei: Chips ✓/−5/Frei/+ −5, Kachel zeigt den Abzug | erfüllt | `transfer-chips.test.ts` (E2E nicht möglich: bis Spieltag 8 ist das Fenster unbegrenzt) |
| Erstkader: Budget, Positionszähler, „Kader speichern“ erst bei gültigen 15 | erfüllt | E2E „Erstkader …“ inklusive Feier „Kader steht!“ |
| Fenster zu: kein Holen, kein Abgeben, Hinweis sichtbar, Stöbern möglich | erfüllt | Zustand `canTrade = false` (auch bei `bankStale`); Liste zeigt „Zu“, Kader „Zu“, Hinweiszeile |
| Spieltag live: Status je Spieler, Live-Punkte zählen bei neuen Daten hoch | erfüllt | Status läuft/Ende/offen aus dem Spielstatus; Hochzählen und Banner über den letzten Datenstand in `localStorage` (`live-diff.test.ts`); lokal mit simulierten Daten geprüft |
| Desktop ab 1024 px: Seitenleiste, zweispaltig, Modals statt Sheets, keine Bottom-Nav | erfüllt | Aufnahmen 1440 px; Bottom-Nav `lg:hidden` |
| `prefers-reduced-motion`: keine Bewegung | erfüllt | Mit Playwright `reducedMotion: "reduce"` auf sechs Seiten: 0 Elemente mit Animation oder Übergang; Zahlen springen (`useCountUp`) |
| Kein Text unter 11 px, keine Tippfläche unter 44 px | erfüllt | Code-Durchsicht: kleinste Schrift 11 px; Knöpfe und Links mobil ≥ 44 px (Schalter per unsichtbarer Fläche) |

## Kontrast

WCAG-Verhältnisse aller Token-Paare (Text auf Grund, Nebentext, Akzent, Kopf, Tafel, Tag,
Navigation, kompakte Leiste, Ticker, Speichern-Pille) sind in beiden Themes ≥ 4,5 : 1.
Dafür zwei Abweichungen vom Entwurf:

- Weiße Schrift auf Rot (Live-Tag, Fehler-Toast, Status „läuft“, Abgabe-Banner, −5-Chip)
  steht auf `karte-tief` `#bf3a24` (5,5 : 1) statt auf `#e0533a` (3,8 : 1).
- `down` im hellen Modus ist `#bf3a24` (4,8 : 1 auf Creme) statt `#c8412b` (4,3 : 1).
- Offene Positions-Kacheln im Erstkader haben im hellen Modus einen dunklen Grund; im
  Entwurf stand weiße Schrift auf Gelb.

## Aufnahmen

Mobil 390 px und Desktop 1440 px, jeweils hell und dunkel, für Anmelden, Team, Markt,
Spieltag (final und Vorschau), Tabelle, Bundesliga, Historie, Spieler und Optionen.
Aufgenommen mit lokalen Testdaten, bei denen Spieltag 3 und 4 als gewertet gelten.
