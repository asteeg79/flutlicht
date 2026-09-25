# Entscheidungen

Getroffene Annahmen und Abweichungen von KONZEPT.md. Neueste Einträge oben.

| Datum | Frage | Entscheidung | Begründung |
|---|---|---|---|
| 2026-09-25 | Transferbank nach unbegrenztem Fenster (2.6: „erhöhen auch nicht den Übertrag“) | Nach einem unbegrenzten Fenster (Kaderaufbau oder Pause) bleibt die Zahl verfügbarer freier Transfers unverändert (`rollTransferBank(bank, true)`); nach normalen Fenstern gilt `2 + min(1, ungenutzt)` | Unbegrenzte Transfers sollen die Zählung nicht beeinflussen, weder nach oben noch nach unten; wer vor der Pause 3 hatte, behält 3 |
| 2026-09-25 | Transferfenster vor dem ersten finalen Spieltag der Saison | Gilt als Pause (unbegrenzt) | Es gibt keine Finalisierung, ab der sich die 10-Tage-Regel messen ließe; praktisch betrifft das nur den Saisonbeginn |
| 2026-09-25 | Transfer, bevor der Tick die Transferbank fortgeschrieben hat | `applyTransfer` weist mit `bank-stale` ab („Bitte in ein paar Minuten erneut versuchen“) | Die Bank wird bei der Finalisierung im Tick (alle 10 Min.) fortgeschrieben; so wird nie gegen einen veralteten Stand gezählt |
| 2026-09-25 | Gelbe und glatt Rote Karte im selben Spiel | −1 und −5 = −6; nur Gelb-Rot ersetzt die Gelbe (−3) | 3.2 regelt nur Gelb + Gelb-Rot; eine glatt Rote nach Gelb ist ein eigenes Vergehen |
| 2026-09-25 | Neuer Kapitän beim Verkauf des Kapitäns | Teuerster Starter nach dem Tausch (der neue Spieler zählt mit), bei Gleichstand der erste in der Startelf-Reihenfolge | 2.3 nennt keinen Tie-Break; die Reihenfolge ist deterministisch |
| 2026-09-25 | Kaufbarkeit | Kaufbar ist ein Spieler nur mit `purchasable && active` | Ein Spieler, der die Bundesliga verlassen hat, darf nicht gekauft werden, auch wenn die Pipeline `purchasable` noch nicht angepasst hat |
| 2026-09-25 | Manager ohne Erstkader | `squad` ist leer (0 oder 15 Spieler), `lineup` ist `null` | 7.3 setzt immer einen Kader voraus, die Reminder in 9 kennen aber den Zustand „kein Erstkader“ |
| 2026-09-25 | Eingabe für `playerMatchPoints` | Normalisierte Werte (Minuten, Note, Tore, Karten, Team-Gegentore …) statt roher Sofascore-JSONs; das Auslesen der Rohdaten kommt in M2 dazu | Dieselbe Funktion rechnet so auch Admin-Nachträge (7.4); die Incident-Klassen sind erst in M2 verifiziert |
| 2026-09-25 | Zeitpunkt für einige 12.x-Übernahmen | `time.ts`, `text.ts`, Schemas für `league`/`system-state`/`review` und die Stammspieler-Auswahl kommen in dem Meilenstein, der sie braucht (M3/M5/M9), nicht schon in M1 | Keine Funktionen auf Vorrat |
| 2026-09-25 | Coverage-Pflicht | `pnpm test` läuft mit Coverage und bricht unter 95 % für `core/src` ab | So prüft auch die CI die M1-Abnahme dauerhaft |
| 2026-09-25 | Tool-Versionen (M0) | Node ≥ 22.12 (CI: Node 22), TypeScript ~5.9, vitest 5, ESLint 10 (Flat Config), Next ^15.5 wie im Konzept | vitest 5 verlangt Node ≥ 22.12; typescript-eslint unterstützt TypeScript nur bis < 6.1, deshalb nicht TS 7. KONZEPT 6.2 nennt Node ≥ 20, Node 22 erfüllt das |
| 2026-09-25 | ESLint-Setup | Eine Root-Flat-Config (WM-Tipp-Muster) für alle Pakete statt `.eslintrc.json` aus Workgrid; ohne sonarjs | Ein Lint-Lauf für das ganze Monorepo; `.eslintrc` wird von ESLint 10 nicht mehr unterstützt; sonarjs ist laut KONZEPT 14 optional |
| 2026-09-25 | Prettier und Markdown | `*.md` und `.vscode/` sind von Prettier ausgenommen | KONZEPT.md und CLAUDE.md sind handgepflegt und sollen nicht umformatiert werden |
| 2026-09-25 | Grundkonzept | siehe KONZEPT.md (Grilling-Runden Q1–Q34 mit Alex) | – |
