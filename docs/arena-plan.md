# Redesign „Arena“: Umsetzungsplan

Quelle: Design-Übergabe `Fussballmanager App Design.zip` (README, `CLAUDE_CODE_AUFGABEN.md`,
Prototypen, Screenshots, Stand 29.09.2026). Gearbeitet wird auf dem Branch `arena`,
eine Phase je Commit `feat(arena): Phase N – …`. Jede Phase endet mit
`pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`; ab Phase 4 zusätzlich
`pnpm --filter @fm/app test:e2e`.

**Stand 30.09.2026:** Phasen 1–8 umgesetzt, Abnahme in `docs/arena-abnahme.md`.

## Leitlinien

- `core/` bleibt maßgeblich. Wo der Prototyp vereinfacht, gilt `core` (Liste unten).
- Farben nur über Tokens (`--bg`, `--surface` …), keine Hex-Werte in Komponenten.
- Neue Bausteine in `app/components/arena/`. Logik steckt in reinen `.ts`-Dateien
  daneben und hat einen Vitest-Test (die App testet ohne DOM).
- Oberfläche: „fixiert“ statt „gesperrt“, Zahlen deutsch, Minus als „−“.
- Jede Animation hängt an der Klasse `arena-anim` und ist per `prefers-reduced-motion` aus.
- E2E-Selektoren über `data-testid` oder Rollen, nicht über Fließtext.

## Phasen

| # | Inhalt | Prüfen |
|---|---|---|
| 1 | Tokens hell/dunkel in `globals.css`, `@theme`-Aliase, `.slant`/`.cut-corner`/Hero-Verlauf, Inline-Script gegen Aufblitzen, `useTheme` | Umschalten per `data-theme` färbt alle Seiten ohne Neuladen |
| 2 | Gerüst: `HeroHeader`, `CompactBar`, `BottomNav` (ein gleitender Balken), `SideNav` ab 1024 px, `TwoCol`, `Toast`, `SavePill`, `Sheet`/`SidePanel`/`Modal` | Alle Seiten im neuen Rahmen, Navigation mobil und Desktop, kompakte Leiste erscheint |
| 3 | Basis-Bausteine (`SlantTag`, `BoardTile`+`useCountUp`, `PosBadge`, `TransferChips`, `PlayerToken`, `Pitch`, `BenchCard`, `CaptainBar`, `Ticker`, `HotCard`/`HotRow`, `MarketRow`/`MarketTable`, `FixtureRow`, `Celebration`), Demo `/dev/arena` nur in der Entwicklung | Demo zeigt alle Bausteine hell und dunkel |
| 4 | Team `/team`: Kopf mit Countdown und Tafel, Spielfeld, Tauschen mit Hervorhebung, Auswahl-Sheet, Formation/Auto, Fixiert-Zustand, Speichern-Pille, Animationen | README 10 (Team), `e2e/market.spec.ts` angepasst |
| 5 | Markt `/markt`: Kopf, Transfer-Chips, Kursänderung (`core/priceChange`), Ticker, „Heiß gerade“, Filter, Holen-Ablauf, Fenster zu, Erstkader, Feier, Desktop-Tabelle | E2E: Erstkader, Holen-Ablauf mit Abzug, Fenster zu |
| 6 | Spieltag: vor Anpfiff, live, final; Rang im Spieltag; Desktop dreispaltig | Seiten rendern in allen drei Zuständen |
| 7 | Tabelle (Podest, Bewegung ▲/▼, Aufstiegs-Animation), Bundesliga (Farbbalken), Historie, Spieler, Optionen (Darstellung), Login/Registrieren/Reset | E2E `pages.spec.ts`, `auth.spec.ts` grün |
| 8 | Feinschliff: Animationen, `reduced-motion`, Kontrast, Tippflächen ≥ 44 px, Text ≥ 11 px; Screenshots 390 px und 1440 px hell/dunkel | README 10 als Checkliste abgehakt |

## Abweichungen vom Prototyp (core gewinnt)

| Prototyp | Umsetzung | Grund |
|---|---|---|
| „Fixiert ab Anpfiff in …“ | „Fixiert in …“ | Gesperrt wird 90 Min. vor Anpfiff (`RULES.lockLeadMinutes`), nicht beim Anpfiff |
| Toast „Anpfiff Dortmund – Kobel ist jetzt fixiert.“ | „Kobel ist jetzt fixiert (Dortmund – Stuttgart).“ | wie oben: der Moment ist die Sperre, nicht der Anpfiff |
| Tausch nur innerhalb einer Position | Gültige Partner sind alle, mit denen `swapPlayers` einen erlaubten Tausch ergibt (z. B. ABW-Starter gegen MF auf der Bank, Formation folgt) | `core/swapPlayers` erlaubt das seit M7; die Hervorhebung fragt `core` |
| Kapitän wechselt beim Tausch automatisch | Kapitän lässt sich nicht auswechseln (Meldung aus `core`); automatischer Wechsel nur nach einem Transfer (`captainChanged`) | `core/swapPlayers` |
| Live-Minute „63′“ je Spieler | Chip „läuft“ (rot, pulsierend), „Ende“, „offen“ aus Spielstatus und Punkten | Die Daten enthalten keine Spielminute; Punkte kommen erst nach Spielende |
| Live-Punkte zählen „bei neuen Daten“ hoch | Beim nächsten Laden: vorheriger Stand liegt in `localStorage`, Differenz ergibt Banner und Hochzählen | Neue Daten kommen als neuer Build (Update-Hinweis) |
| Startbudget ≈ 180 Mio. | 85 Mio. aus `season.json` | Beispieldaten |
| Weiß auf `#e0533a`, `down` hell `#c8412b` | `karte-tief` `#bf3a24` unter weißer Schrift, `down` hell `#bf3a24` | Kontrast ≥ 4,5 : 1 (README 9) |
| Preisfilter im Markt | entfällt | im Entwurf nicht vorgesehen |
| Marktliste komplett | 100 Spieler + „Mehr anzeigen“ | rund 520 Zeilen auf einmal könnten auf älteren Handys stocken |
| Markttabelle mit Vereinsspalte ab 1024 px | 1024–1279 px: Zeilen wie mobil; ab 1280 px Tabelle, Verein unter dem Namen; Vereinsspalte erst ab 1536 px | Neben Navigation (240 px) und Seitenspalte (340 px) blieben dem Namen bei 1280 px nur 86 px, bei 1024 px gar nichts (Fehlermeldung von Alex, 01.10.) |
| Deal-Bestätigung: Verkauf rot, Kauf grün | Verkauf grün, Kauf rot | Farbe folgt dem Geld (Wunsch von Alex) |
| Startelf-Balken bei „So kamen die Punkte“ | kein eigener Balken | Saisonpunkte (`playerSeason`) enthalten den Startelf-Bonus nicht |
