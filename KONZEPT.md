# Flutlicht: Konzept & Umsetzungsplan

> **Für Claude Code.** Dieses Dokument ist die verbindliche Spezifikation. Es wird
> **Meilenstein für Meilenstein** (Abschnitt 13) abgearbeitet. Jede Regel in den
> Abschnitten 2–4 ist normativ. Wo etwas nicht beantwortet ist, gilt Abschnitt 16
> (Annahmen). Neue Annahmen trägst du in `docs/entscheidungen.md` ein und fährst fort.
> Frage nur bei Entscheidungen, die nicht rückgängig zu machen sind.
>
> Stand: 25.09.2026 · Saison 2026/27 · Name „Flutlicht“ (Arbeitstitel war „Fußballmanager“, umbenannt am 26.09.2026)
> Auftraggeber & Admin: Alex (asteeg79)

---

## 0 · Arbeitsweise

1. Lies zuerst `CLAUDE.md`, dann dieses Dokument komplett, dann `reuse/README.md`.
2. Arbeite genau **einen** Meilenstein ab. Er ist fertig, wenn alle Abnahmekriterien
   erfüllt sind **und** `pnpm lint && pnpm typecheck && pnpm test` grün laufen.
   Danach committest du mit `feat(Mx): …` und hakst den Meilenstein in
   `docs/fortschritt.md` ab.
3. **Wiederverwenden vor Neuschreiben.** `reuse/` enthält erprobten Code aus
   Workgrid und dem WM-Tipp-Agent. Kopiere ihn, passe ihn gezielt an und
   vermerke die Herkunft im Dateikopf (`// Übernommen aus Workgrid lib/storage.ts, angepasst: …`).
   Die Tabelle in Abschnitt 12 sagt, was wohin gehört.
4. Reine Logik (Regeln, Punkte, Preise) liegt in `core/` und ist zu 100 % unit-getestet.
   Die Rechenbeispiele in diesem Dokument sind **Pflicht-Testfälle**.
5. UI-Texte, Kommentare und Commit-Messages schreibst du auf Deutsch, Code-Bezeichner auf Englisch.
6. **Niemals** Secrets committen. Scraping-Regeln (Abschnitt 5.6) sind nicht verhandelbar.

---

## 1 · Produkt in Kürze

Ein privater Bundesliga-Fantasy-Manager für eine geschlossene Freundesrunde.

- Jeder Manager stellt aus **allen** Spielern der 1. Bundesliga einen Kader
  mit **Budget** zusammen. Mehrere Manager dürfen denselben Spieler haben.
- Punkte entstehen **datenbasiert** aus der Sofascore-Spielernote und aus Ereignissen
  (Tore, Vorlagen, Karten …). Es gibt keine Redakteursnoten.
- Die Marktwerte bewegen sich nach jedem Spieltag anhand der Leistung.
  Durch den Kaderwert kommt Handel ins Spiel.
- Die App ist eine mobile PWA auf Deutsch mit Push-Benachrichtigungen. Laufende Kosten: 0 €.

**Nicht-Ziele (MVP):** Live-Punkte während des Spiels, Head-to-Head,
2. Liga/Pokal/Europapokal, öffentliche Registrierung, Mailversand, native Apps,
mehrere Ligen/Runden in einer Instanz.

**Später (nicht jetzt bauen):** Verletzungswarnungen (Sofascore liefert
`missingPlayers`, siehe 5.2), Statistik-Charts, Head-to-Head-Modus, Live-Punkte,
Preisformel zusätzlich nach Punkten der Vorsaison, öffentliche Version (Abschnitt 5.7).

---

## 2 · Spielregeln (normativ)

### 2.1 Saison, Spieltage, Zeiten
- Wettbewerb: 1. Bundesliga 2026/27, 34 Spieltage. Der Einstieg erfolgt in die laufende Saison.
  Der erste gewertete Spieltag ist `season.firstScoredMatchday` (Admin-Einstellung).
- Alle Zeiten werden in UTC (ISO 8601) gespeichert und in `Europe/Berlin` angezeigt.
- **Aktueller Spieltag** ist der kleinste Spieltag, der noch nicht `final` ist.
- **Status eines Spieltags:** `upcoming` → `running` (ab erster Sperre) →
  `provisional` (alle Spiele beendet, vorläufige Punkte) → `final`.
- **Finalisierung:** am Morgen nach dem letzten Spiel des Spieltags,
  zufällig zwischen 08:00 und 10:00 Uhr (Berlin). Bei Wochenend-Spieltagen ist das
  der Montag, bei Englischen Wochen der Tag nach dem letzten Mittwochs- bzw.
  Donnerstagsspiel.

### 2.2 Kader
- Jeder Kader hat **genau 15 Spieler**: 2 TW, 5 ABW, 5 MF, 3 ST.
- Pro Bundesligaverein höchstens **5 Spieler**.
- Die Position eines Spielers (`GK|DEF|MID|FWD`) wird beim Saison-Import festgelegt
  und bleibt für die ganze Saison gleich. Der Admin kann sie korrigieren (Abschnitt 11).
- Ein Spieler, der die Bundesliga verlässt, bleibt im Kader, punktet nicht mehr
  (`active=false`) und kann zum letzten Preis verkauft werden.

### 2.3 Aufstellung
- Du stellst **11 Starter** und **4 Bankspieler** (1 Ersatz-TW + 3 Feldspieler
  in einer Reihenfolge B1–B3).
- Erlaubte Formationen (ABW-MF-ST): `3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1`,
  immer mit 1 TW.
- **Übernahme:** Die Aufstellung gilt weiter, bis du sie änderst. Es gibt also
  immer eine gültige Aufstellung. Bei einem Transfer (immer gleiche Position, 2.6)
  übernimmt der neue Spieler exakt den Platz des verkauften (Startelf- oder
  Bankposition). War der verkaufte Spieler Kapitän, wird der teuerste Starter
  Kapitän, und die App weist darauf hin.
- **Automatischer Wechsel:** Spielt ein Starter in seinem gewerteten Spiel
  **0 Minuten** (oder fällt sein Spiel aus, siehe 2.9), rückt der **erste
  Bankspieler derselben Position**, der > 0 Minuten gespielt hat, nach. Die Bank
  wird in der Reihenfolge B1→B3 durchsucht, TW nur durch den Ersatz-TW. Findet
  sich keiner, bleiben 0 Punkte. Jeder Bankspieler rückt höchstens einmal nach.
  Die Formation darf dadurch nicht ungültig werden, was bei gleicher Position
  garantiert ist.
- Ein nachgerückter Spieler erhält **keinen** Startelf-Bonus (3.3).

### 2.4 Kapitän
- Genau ein Kapitän, und er muss unter den 11 Startern sein.
- Alle Punkte des Kapitäns zählen doppelt, **auch negative**.
- **Kein Vize:** Spielt der Kapitän 0 Minuten, verfällt die Verdopplung. Ein
  nachgerückter Bankspieler erbt sie nicht.

### 2.5 Sperren
- Jeder Spieler ist ab **90 Minuten vor Anpfiff seines Spiels** am aktuellen
  Spieltag gesperrt (`lockAt = kickoffUtc − 90 min`). Maßgeblich ist die
  aktuelle Anstoßzeit laut `data/fixtures.json`.
- Ist ein Spieler gesperrt, darf er weder in die Startelf noch aus ihr heraus,
  nicht auf der Bank umsortiert werden und weder Kapitän werden noch aufhören, Kapitän zu sein.
- Ungesperrte Spieler bleiben frei tauschbar, auch wenn andere schon gesperrt sind.
  Einen Formationswechsel prüfst du auf dieselbe Weise: Er ist erlaubt, wenn nur
  ungesperrte Spieler ihre Rolle ändern.
- Der Server entscheidet über Sperren, **nie der Client**. Die Serverzeit ist maßgeblich.

### 2.6 Transfers
- **Transferfenster:** von der Finalisierung von Spieltag N bis zur ersten Sperre
  von Spieltag N+1. Während eines laufenden Spieltags gibt es keine Transfers,
  nur Änderungen an der Aufstellung.
- Ein Transfer ist ein **Tausch** (Verkauf + Kauf derselben Position) in einem
  atomaren Request. Der Kader hat immer 15 Spieler.
- Kauf und Verkauf erfolgen zum **aktuellen Preis** (`players.json`), ohne Gebühr.
  Das Guthaben darf nie negativ werden.
- **Freie Transfers:** 2 pro Spieltag. Ungenutzte verfallen bis auf 1, der übertragen
  wird: `verfügbar(N+1) = 2 + min(1, ungenutzt(N))`, also maximal 3.
- Jeder weitere Transfer kostet **−5 Punkte**. Der Abzug wird auf dem Spieltag
  verbucht, für den der Transfer gemacht wurde (N+1).
- **Unbegrenzt** sind Transfers
  (a) vor dem ersten gewerteten Spieltag eines Managers (Kaderaufbau) und
  (b) in Pausen, also wenn zwischen der Finalisierung von N und der ersten Sperre
  von N+1 **≥ 10 Tage** liegen (Länderspiel- und Winterpause, automatisch erkannt).
  Transfers in (a) und (b) zählen nicht und erhöhen auch nicht den Übertrag.

### 2.7 Guthaben & Kaderwert
- Das **Startbudget** gilt für alle gleich (Berechnung in 4.2). Auch Nachzügler
  erhalten es.
- Das Guthaben ergibt sich aus Startbudget − Käufe + Verkäufe (jeweils zum
  Transaktionspreis). Der Kaderwert ist die Summe der aktuellen Preise. Beides
  wird angezeigt, **gewertet werden nur Punkte**.
- **Spieltagsprämie:** Bei der Finalisierung eines gewerteten Spieltags erhält jeder
  Manager `clamp(round1(0.02 × (Spieltagspunkte − Median aller Manager)), 0, 2.0)` Mio.
  aufs Guthaben (Spieltagspunkte inkl. Kapitän und Transferabzug; Median über alle
  Manager mit Aufstellung an diesem Spieltag). Konstanten `bonusPerPoint`, `bonusCap`
  in `core/src/config/market.ts`.
- **Schattenbetrieb:** Der Spieltag vor dem ersten gewerteten zeigt Punkte und Prämie
  zur Probe, ohne Wertung und ohne Gutschrift.

### 2.8 Wertung
- Spieltagspunkte eines Managers:
  `Σ Punkte der 11 (nach Auto-Wechsel) + Kapitänsbonus − Transferabzug`.
- **Gesamttabelle** nach Summe aller Spieltagspunkte.
  Tie-Break: mehr Spieltagssiege → höchster Einzelspieltag → gleichauf.
- **Spieltagssieger** ist die höchste Punktzahl des Spieltags. Bei Gleichstand gewinnen alle.
- Nachzügler starten mit 0 Punkten ab ihrem ersten Spieltag.
- Gewertet wird ein Spieltag für einen Manager ab dem späteren von seinem ersten
  Spieltag und dem ersten gewerteten Spieltag der Saison (`core/participation`).
  Verschiebt der Admin den Saisonstart, gilt das für Tabelle, Sieger und Prämie gleich.
- Die Aufstellungen **anderer** Manager sind pro Spieler erst ab dessen Sperre
  sichtbar, danach dauerhaft.

### 2.9 Sonderfälle
- **Ausgefallenes oder verlegtes Spiel:** Ein Spiel zählt für Spieltag N nur, wenn es
  vor dessen Finalisierung beendet ist **und** höchstens 3 Tage nach dem
  ursprünglichen Termin stattfindet. Sonst bekommen seine Spieler 0 Punkte für N
  (Auto-Wechsel greift). Nachholspiele werden nie nachträglich gewertet.
- **Spielerwechsel innerhalb der Bundesliga:** Der Verein wird beim Kader-Update
  aktualisiert, der Spieler bleibt in den Kadern der Manager. Das Vereinslimit
  wird nur bei Käufen geprüft. Ein Wechsel kann es also überschreiten, das ist erlaubt.
- **Neuer Spieler in der Bundesliga:** Er kommt beim wöchentlichen Kader-Update hinzu.
  Der Preis richtet sich nach 4.1, fehlende Werte löst die Admin-Liste.
- **Korrekturen nach der Finalisierung:** Nur der Admin kann nachträglich korrigieren
  (Neuberechnung, Abschnitt 11). Alles ist deterministisch aus `raw/` reproduzierbar.

---

## 3 · Punktesystem (normativ, Startwerte)

Alle Werte stehen in `core/src/config/scoring.ts` als **eine** Konstante. Nach den
ersten Spieltagen werden sie kalibriert, ohne Codeänderung an der Logik.

### 3.1 Noten-Punkte
```
ratingPoints = (rating − 6.5) × 10 × min(minutes, 60) / 60
```
- `rating` ist die Sofascore-Note (`statistics.rating`). Fehlt sie (z. B. bei sehr
  kurzen Einsätzen), gilt `ratingPoints = 0`.
- Die Note ist auch negativ möglich.
- **Fließkomma vermeiden:** Rechne in Hundertsteln:
  `ratingPoints = (Math.round(rating × 100) − 650) / 10 × min(minutes, 60) / 60`.
  Sonst ergibt z. B. `(6.45 − 6.5) × 10` den Wert `−0.4999…` statt `−0.5`.
  `roundHalfAwayFromZero` arbeitet mit einem Epsilon von 1e-9.

### 3.2 Ereignis-Punkte

| Ereignis | TW | ABW | MF | ST | Quelle |
|---|---|---|---|---|---|
| Tor (ohne Eigentor) | 8 | 7 | 6 | 5 | incidents `goal`, `incidentClass ≠ ownGoal` |
| Vorlage | 4 | 4 | 4 | 4 | incidents `assist1` (Fallback `statistics.goalAssist`) |
| Zu null (≥ 60 Min. gespielt, Team 0 Gegentore im ganzen Spiel) | 5 | 4 | 1 | 0 | Spielstand |
| je Gegentor ab dem 2. (≥ 60 Min. gespielt, Team-Gegentore im ganzen Spiel) | −1 | −1 | 0 | 0 | Spielstand |
| Elfmeter gehalten | 6 | – | – | – | incidents (Klasse in M2 verifizieren) |
| Elfmeter verschossen | −3 | −3 | −3 | −3 | incidents (Klasse in M2 verifizieren) |
| Eigentor | −3 | −3 | −3 | −3 | incidents `goal` + `incidentClass = ownGoal` |
| Gelbe Karte | −1 | −1 | −1 | −1 | incidents `card` + `yellow` |
| Gelb-Rot | −3 | −3 | −3 | −3 | incidents `card` + `yellowRed` (verifizieren) |
| Rote Karte | −5 | −5 | −5 | −5 | incidents `card` + `red` (verifizieren) |

- Zurückgenommene Karten (`rescinded: true`) zählen nicht.
- Gelb und danach Gelb-Rot ergibt nur −3, nicht −1 −3.
- Spieler mit **0 Minuten** erhalten 0 Punkte, auch bei einer Karte auf der Bank.
  Für den Auto-Wechsel gelten sie als „nicht gespielt“.

### 3.3 Startelf-Bonus
- **+2**, wenn ein Spieler aus der **Startelf des Managers** im echten Spiel in der
  Startelf stand (`substitute === false` in den Sofascore-Lineups).
- Nachgerückte Bankspieler erhalten ihn nicht.
- Der Bonus gehört zu den Spielerpunkten *im Kontext des Managers* und wird deshalb
  beim Kapitän mit verdoppelt.

### 3.4 Rundung & Aggregation
- Pro Spieler und Spiel bildest du die ungerundete Summe
  `ratingPoints + eventPoints`, dann `roundHalfAwayFromZero(x)` → Ganzzahl.
- Startelf-Bonus, Kapitänsverdopplung und Transferabzug rechnest du danach auf
  Ganzzahlen.
- `data/points/md-NN.json` speichert pro Spieler die ungerundeten Einzelteile
  (Breakdown) **und** den gerundeten Basiswert. Die App zeigt den Breakdown an.

### 3.5 Rechenbeispiele (= Pflicht-Tests in `core`)

| # | Situation | Rechnung | Punkte |
|---|---|---|---|
| A | ST, Startelf (Manager + real), 90′, Note 7.8, 1 Tor, 1 Vorlage, Gelb | 13 + 5 + 4 − 1 = 21; +2 Bonus | **23** |
| A′ | wie A, als Kapitän | 23 × 2 | **46** |
| B | ABW, eingewechselt, 30′, Note 6.9, Team zu null | 4 × 30/60 = 2; zu null erst ab 60′ → 0 | **2** |
| C | TW, Startelf, 90′, Note 6.1, 3 Gegentore, 1 Elfer gehalten | −4 − 2 + 6 = 0; +2 Bonus | **2** |
| D | MF, 0′ (Starter beim Manager) | Auto-Wechsel: B1 = MF mit 90′, Note 7.0 → 5 (kein Bonus) | **5** für den Slot |
| E | Kapitän 0′, Bankspieler rückt nach (7 P.) | keine Verdopplung | **7** |
| F | ABW, 75′, Note 6.45, keine Ereignisse, Team 2 Gegentore, Startelf | −0.5 − 1 (2. Gegentor) = −1.5 → roundHalfAway → −2; +2 Bonus | **0** |
| G | ST, Startelf, 90′, Note 5.9, Rot | −6 − 5 = −11; +2 | **−9** (Kapitän: **−18**) |
| H | Manager kauft am Spieltag 5 Spieler, verfügbar 3 | 2 × −5 | **−10** auf den Spieltag |

> Anmerkung zu F: Gerundet wird die Summe (−1.5 → −2), nicht jeder Teil einzeln.
> Der Test fixiert das und prüft zugleich die Hundertstel-Rechnung aus 3.1.

---

## 4 · Preise & Marktwerte (normativ, Startwerte)

Die Konstanten stehen in `core/src/config/market.ts`.

### 4.1 Startpreis
1. **Transfermarkt-Wert `v` (EUR) je Spieler, nach Priorität:**
   1. eigener Crawl zu Saisonstart (Abschnitt 5.4),
   2. dcaribou-Datensatz (Stand 12.06.2026),
   3. Sofascore `player.proposedMarketValueRaw` (Fallback; die Quelle wird markiert),
   4. manuell durch den Admin.

   Ohne Wert landet der Spieler in der Admin-Liste und ist bis zur Klärung nicht kaufbar.
2. **Stauchung (Wurzelskala):**
   ```
   price = clamp( round1( 25 × sqrt(v / vMax) ), 0.5, 25.0 )   // in Mio.
   ```
   `vMax` = höchster Wert aller Bundesliga-Spieler beim Saison-Import. Er wird in
   `data/season.json` eingefroren. `round1` rundet auf 0,1 (half up).
   Beispiele bei vMax = 140 Mio.: 140 → 25.0 · 35 → 12.5 · 8.75 → 6.3 · 0.5 → 1.5 · 0.05 → 0.5.

### 4.2 Startbudget
- **Stammspieler** sind pro Verein die 11 Spieler mit den meisten Einsatzminuten
  der laufenden Saison bis zum Import (aus dem Backfill, 5.5). Das ergibt 198 Spieler.
- `startBudget = ceilTo5( 15 × median(price der Stammspieler) )` in Mio.
  Beispiel: Median 4.2 → 63 → **65 Mio.**
- Der Wert wird in `data/season.json` festgeschrieben. Der Admin kann ihn **vor**
  dem ersten gewerteten Spieltag überschreiben.

### 4.3 Dynamik nach jedem finalen Spieltag
Für jeden Spieler mit **> 0 Minuten** im gewerteten Spiel:
```
E  = Mittel der Basispunkte (3.4, ohne Bonus) seiner letzten 5 Einsätze (> 0′)
     vor diesem Spieltag; ohne Einsatz-Historie: E = defaultExpectation[pos]
     (Start: GK 4, DEF 4, MID 4, FWD 4, nach Kalibrierung anpassen)
P  = Basispunkte dieses Spieltags
Δ% = clamp( 0.02 × (P − E) / 5 , −0.08, +0.08 )
neuerPreis = clamp( round1( alterPreis × (1 + Δ%) ), 0.5, 30.0 )
```
- Spieler mit **0 Minuten** oder ohne gewertetes Spiel behalten ihren Preis.
- Beispiele (Pflicht-Tests): Preis 10.0 und E = 6.
  - P = 18 → +4.8 % → **10.5**
  - P = −4 → −4 % → **9.6**
  - P = 40 → +8 % (Deckel) → **10.8**
- Die Preis-Historie wird pro Spieler geführt (`data/market/history.json`).

---

## 5 · Datenquellen & Abrufplan

### 5.1 Übersicht

| Zweck | Quelle | Wer holt | Frequenz |
|---|---|---|---|
| Spielplan, Anstoßzeiten, Endstatus, Tore (Gegencheck) | **OpenLigaDB** `api.openligadb.de` (frei, ODbL) | GitHub Action | täglich + an Spieltagen stündlich |
| Event-IDs je Spieltag | Sofascore `…/events/round/{n}` | Heim-Rechner | 1× pro Spieltag |
| Aufstellungen, Minuten, Note, Statistiken | Sofascore `event/{id}/lineups` | Heim-Rechner | pro Spiel: vorläufig + final |
| Tore, Vorlagen, Karten, Elfmeter, Eigentore | Sofascore `event/{id}/incidents` | Heim-Rechner | pro Spiel: vorläufig + final |
| Kader, Positionen, Geburtsdaten | Sofascore `team/{id}/players` | Heim-Rechner | wöchentlich; in Transferfenstern alle 2 Tage |
| Start-Marktwerte | Transfermarkt (eigener Crawl) + dcaribou-Datensatz | Heim-Rechner | 1× pro Saison |
| Spielerbilder, Vereinslogos | Sofascore Bild-Endpunkte | Heim-Rechner | 1× pro Saison + neue Spieler |

### 5.2 Sofascore: verifizierte Fakten (Stichprobe 25.09.2026)
- `API = https://api.sofascore.com/api/v1`. Bundesliga: `unique-tournament/35`.
- Saison 26/27: `season/97464` (25/26 = 77333). Liste: `GET /unique-tournament/35/seasons`.
- Spieltag: `GET /unique-tournament/35/season/97464/events/round/{n}` → `events[]`
  mit `id`, `homeTeam{id,name,slug}`, `awayTeam{…}`, `startTimestamp` (Unix s),
  `status{code,type,description}` (beendet: `type:"finished"`, `code:100`),
  `homeScore`, `awayScore`, `roundInfo.round`.
  Beispiel: Spieltag 1 = Event 16434087, Bayern (2672) – Stuttgart (2677).
- `GET /event/{id}/lineups` → `{ confirmed, home, away }`.
  - `home`/`away` = `{ players[], formation, missingPlayers[], supportStaff, … }`.
  - `players[i]` = `{ player{ id, name, slug, shortName, position:"G|D|M|F",
    dateOfBirthTimestamp, proposedMarketValueRaw, … }, teamId, shirtNumber,
    jerseyNumber, position, substitute, captain, statistics{…} }`.
  - `statistics` enthält u. a. `minutesPlayed`, `rating`, `goalAssist`, `saves`,
    `keyPass`, `totalPass`, `accuratePass`, `duelWon`, `duelLost`, `totalShots`, `expectedGoals`, …
  - **Schlüssel mit Wert 0 fehlen oft.** Fehlende Zahl = 0.
  - `missingPlayers[]` = `{ player, type:"doubtful|missing", reason, description, expectedEndDate }`
    (für die spätere Verletzungswarnung).
- `GET /event/{id}/incidents` → `incidents[]` mit `incidentType ∈ {period, card, goal,
  injuryTime, substitution, varDecision, …}`.
  - Tor: `{ player{id}, assist1{id}?, isHome, time, addedTime, incidentClass:
    "regular|ownGoal|penalty|goalAwarded…" }`.
  - Karte: `{ player{id}, incidentClass:"yellow|…", rescinded, reason }`.
  - Wechsel: `{ playerIn{id}, playerOut{id}, time, injury }`.
  - Abpfiff: `incidentType:"period"`, `text:"FT"`.
- **In M2 zu verifizieren** (an echten Spielen als Test-Fixture ablegen):
  Klassen für Gelb-Rot/Rot, verschossener und gehaltener Elfmeter (vermutlich
  eigener `incidentType`), Bild-URLs
  (`https://api.sofascore.app/api/v1/player/{id}/image`, `…/team/{id}/image`),
  Kader-Endpunkt `GET /team/{id}/players`. Ergebnisse dokumentierst du in
  `docs/sofascore-felder.md`. Unbekannte `incidentType`/`incidentClass` loggt die
  Pipeline als Warnung, statt abzustürzen.

### 5.3 OpenLigaDB (frei nutzbar, Namensnennung ODbL)
- `GET https://api.openligadb.de/getmatchdata/bl1/2026/{spieltag}` → Matches mit
  `matchID`, `matchDateTimeUTC`, `team1/team2{teamId, teamName, shortName, teamIconUrl}`,
  `matchIsFinished`, `matchResults[]` (`resultTypeID 2` = Endstand),
  `goals[]{ scoreTeam1, scoreTeam2, matchMinute, goalGetterName, isPenalty, isOwnGoal }`.
- `GET https://api.openligadb.de/getmatchdata/bl1/2026` liefert die ganze Saison.
- Die Vereinszuordnung OpenLigaDB ↔ Sofascore ↔ Transfermarkt pflegst du einmal pro
  Saison in `data/teams.json` (18 Einträge, halbautomatisch per Namensabgleich,
  vom Admin bestätigt).
- Im Impressum der App steht der Hinweis „Spielplandaten: OpenLigaDB (ODbL)“.

### 5.4 Transfermarkt & dcaribou (einmal pro Saison)
- **dcaribou** (CC0, Stand 12.06.2026):
  `https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz`.
  Relevante Spalten: `player_id, name, date_of_birth, position, sub_position,
  current_club_id, current_club_domestic_competition_id ('L1'), market_value_in_eur`.
  Die Spaltennamen prüfst du in M3. Die gefilterte Teilmenge liegt in
  `raw/dcaribou/players-L1.csv`.
- **Eigener Crawl:** Den Dienst `felipeall/transfermarkt-api` (MIT) startest du
  **lokal** per Docker auf dem Heim-Rechner. Abrufe:
  `GET /competitions/L1/clubs`, danach `GET /clubs/{id}/players`
  (Felder `id, name, position, date_of_birth, market_value`).
  Das sind 19 Abrufe mit 60–180 s Abstand. Ergebnis: `raw/transfermarkt/{YYYY-MM-DD}/…`.
  Scheitert der Crawl (403/503), gilt dcaribou → Sofascore → Admin.
- **Zuordnung** Spieler ↔ Transfermarkt: `alnumKey(name)` (aus `reuse/wm-tipp/pipeline/src/util/text.ts`)
  + Geburtsdatum (exakt) + Verein. Zweite Stufe: Nachname + Geburtsdatum.
  Alles Unklare kommt nach `data/review/mapping.json` in die Admin-Liste.

### 5.5 Abrufplan des Heim-Rechners (Scheduler, alle 5 Min. lokal prüfen)
Der Scheduler liest `data/fixtures.json` aus dem lokalen Git-Klon (`git pull`
höchstens alle 30 Min.) und führt fällige Jobs aus. Nur **Jobs** erzeugen Abrufe,
die 5-Minuten-Prüfung selbst ist rein lokal.

| Job | Wann | Abrufe |
|---|---|---|
| `round-events` | Di 10–14 Uhr zufällig, für den nächsten Spieltag | 1 |
| `match-provisional` | Anpfiff + 135–155 Min. (zufällig). Ist das Spiel nicht `finished`: +15 Min., höchstens 3 Versuche | 2 (lineups, incidents) |
| `match-final` | Finalisierungstag 08:00–10:00 Uhr zufällig, alle Spiele des Spieltags nacheinander | 2 × 9 |
| `squads` | Mo und Do 10–18 Uhr zufällig; im Transferfenster (Juli–Aug., Jan.) alle 2 Tage | 18 |
| `backfill` | einmalig beim Start: bereits gespielte Spieltage, über 2–3 Tage verteilt | 2 × 9 × n |
| `images` | einmalig + bei neuen Spielern; höchstens 60 pro Stunde | je 1 |
| `tm-crawl` | einmal pro Saison, manuell ausgelöst | 19 |

Das ergibt etwa **60–75 Sofascore-Abrufe pro Spieltag** (Woche mit zwei Kader-Abrufen). Innerhalb eines Jobs liegen
**8–20 s zufälliger Abstand** zwischen den Abrufen. Es gibt keine Parallelität und
nachts keine Abrufe (00–07 Uhr). Nach jedem Job: `git add raw/ && git commit && git pull --rebase && git push`
(3 Versuche, siehe 6.4).

**Zeitziel:** Vorläufige Punkte stehen spätestens **60 Min. nach Abpfiff** in der App.
Das Budget dafür: 20–40 Min. bis zum Abruf + ~2 Min. Action + ~2 Min. Vercel-Build.

### 5.6 Scraping-Regeln (nicht verhandelbar)
- Nur die oben genannten Endpunkte, nur mit den genannten Frequenzen.
- Zuerst `botasaurus.request` (leichtgewichtig). Nur bei 403 oder Bot-Challenge
  wechselst du auf `botasaurus.browser` (headless Chromium).
  `oseymour/ScraperFC` (GPL-3.0) dient **nur als Referenz** für Endpunkte und wird
  nicht als Abhängigkeit eingebunden.
- Kein Verteilen der Rohdaten: Das Repo ist privat, `raw/` und `data/` werden nie
  öffentlich ausgeliefert.
- Bei 429 oder wiederholten 403: Job abbrechen, 6 h Pause, Warnung im Log. Kein
  aggressives Retry.

### 5.7 Falls die App später öffentlich wird
Dann ist Folgendes nötig: Scraping einstellen (Sofascore, Transfermarkt) und auf eine
lizenzierte API wechseln (Sportmonks/API-Football, Darstellungsrechte prüfen),
Spielerfotos und Vereinslogos entfernen, eigene Startwerte statt Transfermarkt,
OpenLigaDB-Namensnennung beibehalten. Die Architektur bleibt: Nur
`scraper/` wird durch einen API-Adapter ersetzt, `raw/`-Format und `core` bleiben.

### 5.8 Ausfall von Sofascore
- Die Pipeline markiert Spiele ohne Sofascore-Daten als `pending`. Der Spieltag
  bleibt `provisional` bzw. `running`, die App zeigt „Daten ausstehend“.
- OpenLigaDB liefert in der Zwischenzeit Endstand und Tore (nur zur Anzeige, keine Punkte).
- Sind 3 Tage nach Abpfiff noch keine Daten da, erscheint das Spiel in der
  Admin-Liste „Manuell nachtragen“ (Abschnitt 11).

---

## 6 · Architektur

### 6.1 Überblick
```
 Heim-Rechner (Pi/Mac, dauerhaft an)            GitHub (privates Repo)
 ┌──────────────────────────────┐   git push    ┌──────────────────────────────┐
 │ scraper/ (Python, botasaurus)│ ────────────▶ │ raw/**  ──push-Trigger──┐    │
 │ Scheduler (systemd/launchd)  │   raw/…       │                         ▼    │
 │ transfermarkt-api (Docker)   │               │ Action compute.yml:          │
 └──────────────────────────────┘               │  pipeline build (TS, core)   │
                                                │  → data/** (zod-validiert)   │
 OpenLigaDB ◀── Action fixtures.yml ─────────── │  commit data/                │
                                                └──────────────┬───────────────┘
                                                               │ Vercel Git-Build
                                                               ▼
 Cloudflare Worker (Cron */10) ── POST /api/cron/tick ──▶ Vercel: Next.js-App (app/)
                                                         │ liest data/ (gebündelt)
                                                         │ Nutzerdaten ⇄ Upstash Redis
                                                         │ Web-Push (VAPID)
                                                         ▼
                                                       PWA auf den Handys
```

**Grundprinzip:** Git enthält die Fußballwelt (öffentliche Fakten, reproduzierbar).
Redis enthält die Manager (Konten, Kader, Aufstellungen, Transfers). Die App
verbindet beides zur Laufzeit. Die Pipeline kennt **keine** Nutzerdaten.

### 6.2 Repo-Layout (pnpm-Monorepo)
```
flutlicht/
├─ app/                 Next.js 15 (App Router), PWA, API-Routen   → Vercel Root Directory
├─ core/                reine TS-Logik + zod-Schemas (Regeln, Punkte, Preise, Formationen)
├─ pipeline/            TS-Jobs für GitHub Actions: raw/ → data/
├─ scraper/             Python 3.11 für den Heim-Rechner: Sofascore, TM, Bilder → raw/
├─ infra/cron-worker/   Cloudflare Worker: tick-Taktgeber
├─ raw/                 Rohdaten (committet, vom Scraper und den Actions)
├─ data/                abgeleitete Daten (committet, nur von der Pipeline geschrieben)
├─ docs/                entscheidungen.md, fortschritt.md, betrieb.md, sofascore-felder.md
├─ reuse/               Kopien aus Altprojekten (nur Referenz; nach M11 löschen)
├─ .github/workflows/   ci.yml, compute.yml, fixtures.yml, _alert.yml
├─ CLAUDE.md · KONZEPT.md · pnpm-workspace.yaml · package.json
```
- pnpm-Workspaces: `app`, `core`, `pipeline`. `core` wird von beiden als
  `"@fm/core": "workspace:*"` importiert.
- **Versionen wie in Workgrid** (bewährt): `next ^15.5`, `react ^19.2`,
  `next-auth ^5.0.0-beta.31`, `zod ^4`, `@upstash/redis`, `@upstash/ratelimit`,
  `web-push ^3.6`, Tailwind + Radix/shadcn, `lucide-react`, `sonner`, `vitest`,
  `@playwright/test`. Node ≥ 20, pnpm 9.
- **zod v4** überall. Beim Übernehmen von `reuse/wm-tipp/pipeline/src/io/json.ts`
  ersetzt du den v3-Typ `z.ZodType<T, z.ZodTypeDef, unknown>` durch `z.ZodType<T>`.

### 6.3 Wie die App an `data/` kommt
- Das Build-Skript `scripts/stage-data.mjs` (Muster: WM-Tipp) kopiert `data/` nach
  `app/generated/data/` (gitignored), bevor `next build` läuft.
- Serverseitig lädt `app/lib/game-data.ts` die Dateien per statischem `import`
  und validiert sie **einmal** beim Modulstart mit den `core`-Schemas.
  Der Client bekommt Daten nur über Server-Components oder API-Routen. **Kein
  öffentliches `/data/`.**
- Bilder liegen in `app/public/img/players/{sofascoreId}.webp` und
  `app/public/img/clubs/{sofascoreTeamId}.webp` (128 px). Sie werden von der Pipeline
  bzw. vom Scraper committet. Fehlt ein Bild, zeigt die App eine Silhouette (SVG-Komponente).
- `data/meta.json` enthält `{ dataVersion, generatedAt, lastFinalMatchday }`. Die App
  zeigt ein **Frische-Banner** (Muster WM-Tipp), wenn ein Spiel seit > 90 Min.
  beendet ist, aber noch keine Punkte vorliegen.
- Die Versionserkennung übernimmst du von WM-Tipp (`gen-version.mjs`, Commit-Zeitstempel,
  shallow-clone-sicher), angepasst an Next.js (Anzeige in Einstellungen, Poll auf `/version.json`).

### 6.4 Git-Fluss, Builds, Rennen
- Der Scraper pusht mit einem **Deploy-Key** (Schreibrecht nur auf dieses Repo).
  Pushes per Deploy-Key lösen Workflows aus. Pushes der Actions per `GITHUB_TOKEN`
  tun das **nicht**. Deshalb holt `fixtures.yml` OpenLigaDB **und** ruft
  `pipeline build` im selben Lauf auf.
- `compute.yml`: `on: push: paths: [raw/**]` + `workflow_dispatch` + `repository_dispatch`
  (Neuberechnung vom Admin). Concurrency-Gruppe `data-pipeline`,
  `cancel-in-progress: false`.
- Commit-Muster aus WM-Tipp: `git pull --rebase --autostash -X theirs … || git rebase --abort`
  und danach push. Der Scraper macht dasselbe mit 3 Versuchen.
- **Vercel Ignored Build Step** (Projekt-Einstellung, Root `app/`):
  `git diff --quiet HEAD^ HEAD -- ../app ../core ../data ../pnpm-lock.yaml`
  (Exit 0 = Build überspringen). Reine `raw/`-Commits lösen dadurch keinen Build aus.
- **Sanity-Guard** in `pipeline build` (Muster WM-Tipp): Abbruch ohne Schreiben, wenn
  < 18 Vereine, < 400 Spieler, ein als beendet markiertes Spiel < 22 Spieler mit
  Minuten hat oder ein Preis außerhalb [0.5, 30] liegt.
- **Fehler-Alarm:** `_alert.yml` übernimmst du 1:1 (Issue mit Label `pipeline-failure`).

### 6.5 Pipeline `pipeline build` (deterministisch, idempotent)
Jeder Lauf berechnet **alles** aus `raw/` + `raw/manual/` + `core`-Config neu:
1. `teams` ← `raw/manual/teams.json` + Sofascore-Kader + OpenLigaDB
2. `players` ← Sofascore-Kader (+ Positionen aus dem Saison-Import, eingefroren in
   `raw/manual/positions.json`) + Marktwert-Quellen (4.1) → Startpreise
3. `fixtures` ← OpenLigaDB-Spielplan + Sofascore-Event-IDs (Zuordnung über Vereine + Datum)
4. `points/md-NN.json` ← pro Spiel `raw/manual/matches/{eventId}.json` **vor**
   Sofascore-final **vor** Sofascore-provisional
5. `market` ← Preise Spieltag für Spieltag fortschreiben (4.3), nur für `final`-Spieltage
6. `season.json`, `meta.json`, `review/*.json`
7. Validieren (zod) → Sanity-Guard → schreiben (`writeJson` aus reuse)

---

## 7 · Datenmodell

Alle Schemas stehen als zod in `core/src/schemas/`. Typen leitest du mit `z.infer` ab.

### 7.1 `data/` (von der Pipeline)
```ts
// data/season.json
{ season: "2026/27", sofascoreTournamentId: 35, sofascoreSeasonId: 97464,
  openligaSeason: 2026, firstScoredMatchday: number, vMaxEur: number,
  startBudget: number /* Mio */, matchdays: 34 }

// data/teams.json
[{ id: number /* Sofascore teamId */, name, shortName, openligaTeamId: number,
   tmClubId?: string, logo: string /* /img/clubs/{id}.webp */ }]

// data/players.json
[{ id: number /* Sofascore playerId */, name, shortName, teamId: number,
   position: "GK"|"DEF"|"MID"|"FWD", birthDate: "YYYY-MM-DD",
   tmId?: string, startValueEur?: number,
   valueSource: "tm-crawl"|"dcaribou"|"sofascore"|"manual"|"missing",
   price: number /* aktuell, Mio, 1 Nachkommastelle */, purchasable: boolean,
   active: boolean, image?: string }]

// data/fixtures.json
[{ matchday: number, openligaMatchId: number, sofascoreEventId?: number,
   homeTeamId: number, awayTeamId: number, kickoffUtc: string,
   originalKickoffUtc: string, status: "scheduled"|"live"|"finished"|"postponed",
   score?: { home: number, away: number }, dataState: "none"|"provisional"|"final"|"manual"|"pending" }]

// data/points/md-NN.json
{ matchday, status: "running"|"provisional"|"final", generatedAt,
  players: { [playerId]: {
     eventId: number, minutes: number, started: boolean, rating: number|null,
     parts: { rating: number, goals: number, assists: number, cleanSheet: number,
              conceded: number, penSaved: number, penMissed: number,
              ownGoals: number, cards: number },
     base: number /* gerundet, ohne Bonus */ } } }

// data/market/history.json
{ [playerId]: [{ matchday: number, price: number }] }

// data/review/mapping.json · data/review/missing-values.json · data/review/manual-needed.json
// data/meta.json
{ dataVersion: string, generatedAt: string, lastFinalMatchday: number|null }
```

### 7.2 `raw/` (Scraper + Actions)
```
raw/sofascore/rounds/round-NN.json
raw/sofascore/matches/{eventId}/{provisional|final}/{lineups,incidents}.json   (+ fetchedAt)
raw/sofascore/squads/{YYYY-MM-DD}/{teamId}.json
raw/openligadb/season-2026.json
raw/transfermarkt/{YYYY-MM-DD}/clubs.json, club-{id}.json
raw/dcaribou/players-L1.csv
raw/manual/teams.json · positions.json · values.json · mapping.json
raw/manual/matches/{eventId}.json        ← Admin-Nachtrag (Format = Sofascore-lite, 7.4)
```

### 7.3 Redis (Upstash, Muster Workgrid `lib/storage.ts`, AES-GCM je Dokument)
```
user-{userId}-data.json.enc      Manager-Dokument (Schlüssel = userId)
email-index.json.enc             { [emailLower]: userId }       (Schlüssel konstant)
league.json.enc                  Einladungs- & Reset-Codes, Liga-Einstellungen
system-state.json.enc            Tick-Idempotenz (gesendete Pushes, finalisierte Spieltage)
```
```ts
// Manager-Dokument
{ userId: string /* uuid */, email: string, displayName: string, teamName: string,
  passwordHash: string /* scrypt, siehe 8.3 */, role: "admin"|"player",
  createdAt, updatedAt /* server-eigen, optimistische Sperre */,
  firstMatchday: number,
  squad: number[] /* 15 playerIds */,
  cash: number /* Mio */,
  lineup: { formation: "4-4-2"|…, starters: number[11], bench: { gk: number, b: [number,number,number] }, captain: number },
  lineupHistory: { [matchday]: Lineup }            // eingefroren bei Finalisierung
  transfers: [{ at: string, matchday: number /* für den gezählt wird */, out: number, in: number,
                priceOut: number, priceIn: number, free: boolean }],
  transferBank: { matchday: number, available: number },
  push?: { subscription: PushSubscriptionJSON, prefs: { reminder: boolean, daily: boolean, final: boolean } } }
```
- Schreibzugriffe gehen **nur** über API-Routen. Jede Schreibroute: laden → Regeln
  aus `core` prüfen → `updatedAt` vergleichen (bei Abweichung 409, der Client lädt neu)
  → speichern.
- Der Push-Teil ist server-verwaltet, wie in Workgrid (`keepServerOwnedFields`).
- Upstash Free: 500 K Befehle/Monat, 256 MB. Das reicht für diese Nutzung um
  Größenordnungen: Tick alle 10 Min. × ~15 Befehle ≈ 65 K/Monat.

### 7.4 Admin-Nachtrag (`raw/manual/matches/{eventId}.json`)
```ts
{ eventId, enteredBy, enteredAt, score: { home, away },
  players: [{ playerId, started: boolean, minutes: number, rating: number|null,
              goals: number, assists: number, ownGoals: number,
              yellow: boolean, yellowRed: boolean, red: boolean,
              penMissed: number, penSaved: number }] }
```

---

## 8 · App (Next.js auf Vercel)

### 8.1 Seiten (mobil zuerst, Deutsch)
| Route | Inhalt |
|---|---|
| `/login` · `/registrieren` · `/passwort-reset` | E-Mail + Passwort, Registrierung mit Einladungscode, Reset mit Admin-Code |
| `/team` (Start) | Spielfeld-Ansicht mit Formation, Bank B1–B3 + Ersatz-TW, Kapitän (C), Sperr-Schloss pro Spieler mit Countdown, Punkte des laufenden Spieltags |
| `/markt` | Spielerliste mit Filtern (Position, Verein, Preis), Sortierung (Preis, Punkte, Form = Ø letzte 5), Tausch-Dialog, Anzeigen: Guthaben, freie Transfers, Vereinslimit |
| `/spieltag/[n]` | Meine Punkte mit Aufschlüsselung pro Spieler, Auto-Wechsel markiert, andere Manager (je Spieler erst nach Sperre) |
| `/tabelle` | Gesamt + Spieltagssieger, Verlauf |
| `/spieler/[id]` | Profil: Preisverlauf, Punkte je Spieltag mit Breakdown |
| `/einstellungen` | Push je Typ, iPhone-Hinweis „Zum Home-Bildschirm“, Passwort ändern, Version, Abmelden |
| `/admin` | Abschnitt 11 (nur `role=admin`) |

Die UI übernimmt Stack und Muster aus Workgrid (Tailwind, Radix/shadcn, sonner,
lucide). Das visuelle Design legst du in M5 mit dem Skill `frontend-design` fest:
eigene Farbwelt „Rasen/Flutlicht“, **keine** Vereins- oder Liga-Marken als Design-Element.

### 8.2 API-Routen
Alle unter `withUser` (Workgrid), außer den ausdrücklich öffentlichen
(`lib/public-api-paths.ts` + Guard-Test aus Workgrid).

| Methode & Pfad | Auth | Regeln / Wirkung |
|---|---|---|
| `POST /api/auth/register` | öffentlich | Einladungscode gültig und unbenutzt, E-Mail neu, Passwort ≥ 10 Zeichen → Manager anlegen, Code verbrauchen |
| `/api/auth/[...nextauth]` | öffentlich | NextAuth Credentials (E-Mail + Passwort) |
| `POST /api/auth/reset` | öffentlich | Reset-Code gültig (24 h, einmalig) → neues Passwort |
| `GET /api/me` | User | Manager-Dokument ohne Hash |
| `POST /api/squad/initial` | User | Erstkader: 15 Spieler, Positionen, Vereinslimit, Budget, nur vor `firstMatchday` bzw. in Pause |
| `POST /api/transfer` | User | `{out, in}`: Fenster offen, gleiche Position, Vereinslimit, Guthaben, `purchasable`, Zählung laut 2.6 |
| `PUT /api/lineup` | User | Formation, Starter, Bank, Kapitän. Sperren laut 2.5, Validierung laut 2.3/2.4 |
| `GET /api/standings` | User | Tabelle live berechnet (8.4) |
| `GET /api/matchday/[n]` | User | Punkte pro Manager und Spieler; fremde Aufstellungen gefiltert nach Sperre |
| `POST/DELETE /api/push/subscribe` | User | Muster Workgrid |
| `PUT /api/push/prefs` | User | Push-Typen an/aus |
| `POST /api/cron/tick` | Bearer `CRON_SECRET` | Abschnitt 9 |
| `/api/admin/*` | Admin | Abschnitt 11 |
| `GET /api/health` | öffentlich | Muster Workgrid |

### 8.3 Authentifizierung
- **NextAuth v5, JWT-Session 30 Tage** (Workgrid `auth.config.ts` / `auth.ts`). Den
  Google- und Passkey-Provider entfernst du. Dafür kommt **ein** Credentials-Provider
  mit `{ email, password }` dazu. Die stabile `token.uid` ist die `userId` (UUID) aus
  dem Manager-Dokument (siehe Kommentar zur stabilen ID in Workgrid `auth.ts`).
- **Passwort-Hash:** `node:crypto` `scrypt` (N=2^15, r=8, p=1, keylen 64, 16 B Salt),
  gespeichert als `scrypt$N$r$p$saltB64$hashB64`. Vergleich mit `timingSafeEqual`.
  Es gibt keine zusätzliche Abhängigkeit.
- **E-Mail-Index** (`email-index.json.enc`) nach dem Muster des Passkey-Index in Workgrid.
- **Admin** ist, wer mit einer E-Mail in `ADMIN_EMAILS` registriert. Das wird bei der
  Registrierung als `role` gesetzt.
- **Rate-Limit** aus Workgrid-`middleware.ts`. Zusätzlich gilt für Login, Registrierung
  und Reset: 10 Versuche pro 15 Min. pro IP.
- Einladungs- und Reset-Codes: 8 Zeichen aus `[A-HJ-NP-Z2-9]`, einmalig; Reset-Codes
  laufen nach 24 h ab.

### 8.4 Wertung zur Laufzeit
`/api/standings` und `/api/matchday/[n]` berechnen die Punkte aus `data/points/*`
+ allen Manager-Dokumenten (`listAllUserData` aus Workgrid) mit `core/scoreManager()`:
- Spieltage mit `status=final` rechnest du aus `lineupHistory[n]`, laufende aus `lineup`.
- Auto-Wechsel, Kapitän, Startelf-Bonus und Transferabzug stehen ausschließlich in `core`.
- Bei ≤ 20 Managern ist kein Cache nötig.

### 8.5 PWA & Push
- Service Worker aus Workgrid `public/sw.js` (cacht **nie** `/api/`).
  **Ergänzen:** `push`- und `notificationclick`-Handler. Die fehlen in Workgrid, dort
  werden Push-Nachrichten deshalb nicht angezeigt.
  ```js
  self.addEventListener("push", (e) => {
    const d = e.data ? e.data.json() : {};
    e.waitUntil(self.registration.showNotification(d.title ?? "Flutlicht", {
      body: d.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png",
      data: { url: d.url ?? "/team" }, tag: d.tag }));
  });
  self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const url = e.notification.data?.url ?? "/team";
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    }));
  });
  ```
- Übernehmen: `hooks/usePush.ts`, `lib/push.ts` (`web-push`, VAPID),
  `ServiceWorkerRegister.tsx` und `manifest.json` (Name, Farben, `start_url: "/team"`).
- **iOS:** Push funktioniert nur, wenn die App über „Zum Home-Bildschirm“ installiert ist.
  Die Einstellungen erkennen `navigator.standalone` bzw. `display-mode: standalone`
  und zeigen sonst eine Anleitung.

---

## 9 · Taktgeber & Push-Logik (`/api/cron/tick`)

- **Warum ein externer Taktgeber:** Vercel Hobby erlaubt Crons nur **1× täglich**
  (±59 Min.). Deshalb übernimmst du den Cloudflare-Worker aus WM-Tipp
  (`reuse/wm-tipp/infra/cron-worker/`), angepasst:
  Cron `*/10 * * * *`, `POST https://<app>/api/cron/tick` mit
  `Authorization: Bearer ${CRON_SECRET}`. Kein Monatsfilter, keine Nachtpause
  nötig, weil der Tick billig ist.
- **Der Tick ist idempotent.** Jede Aktion hat einen Schlüssel in `system-state.json.enc`
  und wird höchstens einmal ausgeführt.

| Aktion | Bedingung | Schlüssel |
|---|---|---|
| Erinnerung 24 h | `now ≥ firstLock(N) − 24h` und (kein Erstkader **oder** ein Starter ist `active=false` **oder** der Verein eines Starters hat an Spieltag N kein Spiel) | `remind24:{N}:{userId}` |
| Erinnerung 3 h | wie oben mit 3 h | `remind3:{N}:{userId}` |
| Tagesfazit | alle Spiele eines Kalendertags sind `dataState ≥ provisional`, nach 20:00 Uhr | `daily:{YYYY-MM-DD}:{userId}` |
| Finalisierung | `data` meldet Spieltag N `final` → `lineupHistory[N] = lineup` für alle, Transferbank fortschreiben | `final:{N}` |
| Endergebnis-Push | nach der Finalisierung: Platz, Punkte, Spieltagssieger | `finalpush:{N}:{userId}` |

- Push-Texte (Deutsch, kurz):
  - „⏰ Noch 3 Std. bis zur ersten Sperre an Spieltag 7 — deine Aufstellung ist unvollständig.“
  - „📊 Samstag: 48 Punkte (vorläufig). Du bist 3. im Spieltag.“
  - „🏁 Spieltag 7 final: 61 Punkte, Platz 2 gesamt. Spieltagssieger: Tom (74).“
- Abgelaufene Subscriptions (404/410) entfernst du wie in Workgrid.

---

## 10 · Heim-Rechner (`scraper/`)

- **Plattform:** Raspberry Pi 4/5 (64-bit) oder ein Mac, der dauerhaft läuft.
  Python 3.11, `botasaurus`, `pillow` (WebP), `httpx`, Chromium für den Browser-Modus,
  Docker für `transfermarkt-api`.
- **Struktur:** `scraper/fm_scraper/{client.py, jobs/*.py, scheduler.py, gitsync.py, config.py}`.
  - `client.py` ist die **einzige** Stelle für HTTP: Pacing, request→browser-Fallback,
    429/403-Pause.
  - `scheduler.py` wird alle 5 Min. aufgerufen (systemd-Timer bzw. launchd-Plist,
    beides in `scraper/deploy/`). Er liest `data/fixtures.json` und einen lokalen
    Zustand (`~/.fm-scraper/state.json`), zieht die zufälligen Zeitpunkte **einmal
    pro Job** und speichert sie, damit sie bei jedem Aufruf gleich bleiben.
  - `gitsync.py`: pull --rebase, add raw/, commit `raw: <job> <zeit>`, push (3 Versuche).
- **Ausgabe:** Rohes JSON unverändert + `{ fetchedAt, url, phase }` als Hülle.
- **Tests:** `pytest` für Scheduler-Entscheidungen (Zeitfenster, Retries, Nachtpause)
  mit fester Uhr. Es gibt keine Netzwerktests.
- **Betrieb:** `scraper/README.md` beschreibt Einrichtung (Deploy-Key, Klon,
  venv, Timer), Logs (`journalctl -u fm-scraper`) und manuelles Auslösen einzelner
  Jobs (`python -m fm_scraper run match-final --matchday 7`).

---

## 11 · Admin-Funktionen (`/admin`)

Admin-Aktionen, die die Fußballwelt ändern, laufen **über Git**: Die App committet
per GitHub-API (fine-grained PAT, nur dieses Repo, Contents R/W + Actions) nach
`raw/manual/…`. Das löst `compute.yml` aus. Muster: `fetch` auf `api.github.com` wie
im WM-Tipp-Worker.

| Funktion | Wirkung |
|---|---|
| Einladungscodes erzeugen/widerrufen | `league.json.enc` |
| Reset-Code für Manager erzeugen | `league.json.enc`, 24 h gültig |
| Spieler-Zuordnung klären | Liste aus `data/review/mapping.json` → Auswahl → `raw/manual/mapping.json` |
| Fehlende Werte / Positionen setzen | `raw/manual/values.json`, `raw/manual/positions.json` |
| Spieldaten von Hand nachtragen | Formular je Spiel (beide Kader, Felder aus 7.4) → `raw/manual/matches/{eventId}.json` |
| Neuberechnung | `repository_dispatch` `event_type: recompute` → `compute.yml` |
| Startbudget / erster gewerteter Spieltag | `raw/manual/season.json` (nur vor dem ersten gewerteten Spieltag) |
| Status-Übersicht | Letzter Scraper-Commit, letzter Pipeline-Lauf, ausstehende Spiele, Tick-Zustand |

---

## 12 · Wiederverwendung aus Altprojekten

Die Dateien liegen als Kopie in `reuse/` (Quelle: `~/Documents/Claude/Projects/…`).
**Nicht** blind übernehmen. Die Spalte „Anpassung“ ist Pflicht.

### 12.1 Aus Workgrid (`reuse/workgrid/`)
| Datei | Ziel | Anpassung |
|---|---|---|
| `lib/storage.ts` | `app/lib/storage.ts` | Google-Token-Teil und Passkey-Index entfernen; `email-index`, `league`, `system-state` nach demselben Muster ergänzen. Redis-Fehler **nicht** abfangen, Unlesbares wirft (beides beibehalten) |
| `lib/crypto.ts` | `app/lib/crypto.ts` | unverändert |
| `lib/api-route.ts` | `app/lib/api-route.ts` | unverändert. `withAdmin` ergänzen (prüft `role`) + `Conflict`(409), `Forbidden`(403) |
| `lib/auth.config.ts`, `lib/auth.ts` | `app/lib/` | Google/Passkey raus, Credentials(E-Mail+Passwort) rein, `PROTECTED_PREFIXES` = `/team,/markt,/spieltag,/tabelle,/spieler,/einstellungen,/admin` |
| `middleware.ts`, `lib/public-api-paths.ts`, `lib/rate-limit.ts` | `app/` | Domain-Redirect auf neue Domain, Matcher an neue Routen anpassen, Prefix `fm-rl` |
| `middleware.guard.test.ts`, `middleware.auth.test.ts` | `app/` | Guard-Test 1:1 übernehmen (hält Allowlist ↔ `withUser` konsistent) |
| `lib/push.ts`, `app/api/push/subscribe/route.ts`, `app/api/push/send/route.ts` | `app/` | `send` wird zu `/api/cron/tick` mit der Logik aus Abschnitt 9 |
| `hooks/usePush.ts`, `components/settings/PushToggle.tsx` | `app/` | Push-Typen-Schalter ergänzen |
| `public/sw.js`, `components/pwa/ServiceWorkerRegister.tsx`, `public/manifest.json` | `app/` | **Push-Handler ergänzen** (8.5), Cache-Name `fm-v1`, Name/Farben/`start_url` |
| `next.config.js` | `app/` | CSP beibehalten (`img-src 'self' data: blob:`, Google-Hosts raus), Build-Datum Europe/Berlin beibehalten |
| `lib/time-local.ts` | `core/src/time.ts` | um `Europe/Berlin`-Formatierung mit `Intl` erweitern (Server läuft in UTC!) |
| `vitest.config.ts`, `playwright.config.ts`, `.prettierrc`, `.eslintrc.json`, `tsconfig.json` | `app/` | Pfade anpassen |
| `app/(auth)/login/page.tsx` | `app/app/(auth)/login/` | als UI-Muster; Google/Passkey-Buttons durch Formular ersetzen |
| `CLAUDE.md` (Projektordner) | `CLAUDE.md` | allgemeine Arbeitsregeln sind bereits übernommen |

### 12.2 Aus dem WM-Tipp-Agent (`reuse/wm-tipp/`)
| Datei | Ziel | Anpassung |
|---|---|---|
| `pipeline/src/io/json.ts` | `pipeline/src/io/json.ts` | zod v4-Typ (6.2) |
| `pipeline/src/sources/http.ts` | `pipeline/src/sources/http.ts` | für OpenLigaDB (Backoff, Retry-After) |
| `pipeline/src/util/async.ts`, `util/text.ts` | `pipeline/src/util/` bzw. `core/src/text.ts` | `alnumKey`/`foldDiacritics` für Namensabgleich |
| `shared/src/common.ts` | `core/src/schemas/common.ts` | nur `IsoDateTime`, `IsoDate`, `ScoreLine`, `MatchStatus` behalten |
| `.github/workflows/_alert.yml` | 1:1 | – |
| `.github/workflows/news.yml` | Vorlage für `fixtures.yml`, `compute.yml` | Commit-/Rebase-Block übernehmen, Concurrency-Gruppe `data-pipeline` |
| `.github/workflows/ci.yml` | `ci.yml` | `paths-ignore: raw/**, data/**, docs/**, **.md` |
| `infra/cron-worker/worker.mjs`, `wrangler.jsonc` | `infra/cron-worker/` | statt `repository_dispatch` → `POST /api/cron/tick`; Cron `*/10 * * * *`; Secret `CRON_SECRET` |
| `scripts/gen-version.mjs`, `app/src/lib/useVersion.ts` | `scripts/`, `app/hooks/useVersion.ts` | Next statt Vite: `version.json` nach `app/public/`, ohne `vite-plugin-pwa` |
| `scripts/stage-data.mjs` | `scripts/stage-data.mjs` | Ziel `app/generated/data/` |
| `eslint.config.mjs`, `tsconfig.base.json`, `vitest.config.ts`, `pnpm-workspace.yaml`, `.prettierrc.json` | Root | Pakete `app, core, pipeline` |
| `docs/betrieb.md` | `docs/betrieb.md` | als Gliederungsvorlage (Datenarten, Taktung, Schutzmechanismen, Troubleshooting) |

### 12.3 Erfahrungen aus den Altprojekten (unbedingt beachten)
1. **Vercel Blob ist nur eventually consistent.** Workgrid musste auf Redis umziehen.
   Für Nutzerdaten gilt: nur Redis.
2. **Unlesbar ≠ leer.** Wirft der Storage bei kaputten Daten nicht, überschreibt der
   nächste Save das Konto.
3. **Service Worker:** API nie cachen. `next-pwa` hat in Workgrid zu Stale-Caches
   geführt und wurde entfernt. Push-Handler nicht vergessen.
4. **GitHub `schedule` ist unzuverlässig** (Drosselung). Für genaue Zeitpunkte gibt es den Cloudflare-Worker.
5. **Git-Rennen** zwischen Pipeline-Läufen: Concurrency-Gruppe + `rebase -X theirs`.
6. **`GITHUB_TOKEN`-Pushes starten keine Workflows** (6.4).
7. **Versionsnummer nicht aus der Commit-Anzahl** ableiten: Vercel klont shallow.
   Commit-Zeitstempel verwenden.
8. **Build-Zeit in Europe/Berlin formatieren.** Der Build läuft in UTC.
9. **Stabile User-ID:** Ohne DB-Adapter vergibt NextAuth bei jedem Login neue IDs.
   Deshalb die UUID aus dem Manager-Dokument in `token.uid` setzen.
10. **Allowlist-Guard-Test:** Eine neue API-Route ohne `withUser` fällt im Test auf.

---

## 13 · Meilensteine (Reihenfolge = Abarbeitung)

Jeder Meilenstein endet mit grünem `pnpm lint && pnpm typecheck && pnpm test` und
einem Eintrag in `docs/fortschritt.md`.

### M0 · Repo & Werkzeuge
- Monorepo gemäß 6.2, Tooling aus `reuse/`, `ci.yml`, `_alert.yml`, `.gitignore`
  (`app/generated/`, `.env*`, `.next`), `docs/entscheidungen.md`, `docs/fortschritt.md`.
- **Abnahme:** CI läuft auf GitHub grün; `pnpm -r typecheck` findet alle drei Pakete.

### M1 · `core`: Schemas & Regeln (ohne I/O)
- zod-Schemas aus 7.1/7.3/7.4. Konfig-Konstanten `scoring.ts`, `market.ts`, `rules.ts`
  (Kadergröße, Positionen, Formationen, Vereinslimit, Transfers, Sperrvorlauf).
- Funktionen (rein, getestet):
  - `validateSquad`, `validateLineup`, `isLocked(player, now, fixtures)`, `diffLineupRespectsLocks`
  - `transferQuote(bank, window)`, `applyTransfer`
  - `playerMatchPoints(raw)` (3.1–3.4), `scoreManager(md, lineup, points, transfers)`
    (Auto-Wechsel, Kapitän, Bonus, Abzug)
  - `startPrice(v, vMax)`, `startBudget(prices)`, `nextPrice(price, P, E)`, `expectation(history, pos)`
  - `transferWindow(fixtures, finals, now)` inkl. ≥ 10-Tage-Pausenregel
  - `roundHalfAwayFromZero`, `round1`
- **Abnahme:** Alle Beispiele aus 3.5, 4.1, 4.2 und 4.3 sind Tests. Coverage `core` ≥ 95 %.

### M2 · Datenerkundung & Scraper-Grundgerüst
- `scraper/` mit `client.py` (Pacing, Fallback, Pausen), `gitsync.py`, CLI `run <job>`.
- Jobs `round-events` und `match-final` für **ein** beendetes Spiel manuell ausführen.
  Die Rohdaten werden Test-Fixtures in `core/test/fixtures/sofascore/`.
- Die offenen Punkte aus 5.2 verifizierst du und dokumentierst sie in
  `docs/sofascore-felder.md`: Karten- und Elfmeterklassen, Bild-URLs, Kader-Endpunkt.
  Falls nötig passt du Tabelle 3.2 in `scoring.ts` an und vermerkst es in `entscheidungen.md`.
- **Abnahme:** `playerMatchPoints` rechnet das Fixture-Spiel komplett durch.
  Stichprobe von 3 Spielern von Hand nachgerechnet und im Test festgehalten.

### M3 · Saison-Import
- Jobs `squads`, `tm-crawl` (Docker-Dienst lokal), dcaribou-Download,
  `backfill` (bereits gespielte Spieltage), `images`.
- Pipeline-Schritte `teams`, `players` (Zuordnung, Startpreise, Budget), `review`.
- `raw/manual/teams.json` (18 Vereine, 3 IDs je Verein) legst du an und lässt den Admin bestätigen.
- **Abnahme:** `data/players.json` ≥ 450 Spieler, alle 18 Vereine, jeder Spieler
  hat eine Position, ≥ 95 % haben einen Preis. `data/review/*.json` listet den Rest.
  `season.json` enthält vMax und Startbudget.

### M4 · Pipeline-Automatisierung
- `pipeline build` (6.5) inkl. Sanity-Guard, `compute.yml`, `fixtures.yml`
  (OpenLigaDB täglich, an Spieltagen stündlich per Cloudflare-Dispatch **oder**
  GitHub-Schedule als Best-effort).
- Alarm „Scraper überfällig“: `fixtures.yml` meldet per `_alert`, wenn ein Spiel seit
  > 3 h beendet ist und `dataState = none`.
- **Abnahme:** Ein Push nach `raw/` erzeugt in < 5 Min. einen `data/`-Commit.
  Ein kaputtes Raw-File führt zu einem roten Lauf + Issue, `data/` bleibt unverändert.

### M5 · App-Grundgerüst & Login
- Next.js-App mit Workgrid-Bausteinen (12.1), `stage-data.mjs`, `game-data.ts`,
  Layout mit Bottom-Navigation, Design mit Skill `frontend-design`.
- Registrierung, Login, Reset, Abmelden; Admin-Rolle; Rate-Limits; Guard-Test.
- **Abnahme (Playwright):** mit Einladungscode registrieren → einloggen → ausloggen →
  mit Reset-Code neues Passwort setzen. Ungültiger Code wird abgewiesen. `/api/*`
  ohne Session liefert 401 JSON.

### M6 · Kader & Markt
- `/markt`, `POST /api/squad/initial`, `POST /api/transfer`, Guthaben- und Transferanzeige.
- **Abnahme:** Unit-Tests der Routen für jede Regel aus 2.2/2.6/2.7
  (Budget überschritten, 6. Spieler eines Vereins, falsche Position, Fenster zu,
  Zählung und Übertrag, Pausen unbegrenzt). E2E: Erstkader bauen.

### M7 · Aufstellung & Sperren
- `/team` mit Spielfeld, Formation, Bank-Reihenfolge, Kapitän, Schloss-Symbolen und Countdown.
  `PUT /api/lineup` prüft die Sperren serverseitig.
- **Abnahme:** Tests mit gemockter Uhr: Tausch mit gesperrtem Spieler → 409/400 mit
  deutscher Meldung; Tausch zweier ungesperrter Spieler an einem laufenden Spieltag → ok;
  Kapitänswechsel bei gesperrtem Alt-Kapitän → abgewiesen.

### M8 · Punkte, Spieltag, Tabelle
- `/api/standings`, `/api/matchday/[n]`, `/spieltag/[n]`, `/tabelle`, `/spieler/[id]`.
- Sichtbarkeit fremder Aufstellungen nach Sperre.
- **Abnahme:** Szenario-Test mit 3 Managern über 2 Spieltage (Fixture-Daten) →
  erwartete Tabelle inkl. Auto-Wechsel, Kapitän und Transferabzug.

### M9 · Push & Taktgeber
- VAPID-Keys, Subscribe-Flow, SW-Handler, `/api/cron/tick` mit Idempotenz (Abschnitt 9),
  Cloudflare-Worker deployen.
- **Abnahme:** Test-Push aus `/einstellungen` kommt auf Android und installiertem iOS an.
  Ein doppelter Tick sendet nichts doppelt (Test). Die Finalisierung friert
  `lineupHistory` ein.

### M10 · Admin
- Alle Funktionen aus Abschnitt 11, GitHub-Commit-Helper `app/lib/github.ts`.
- **Abnahme:** Ein manueller Spielnachtrag erzeugt einen Commit → Pipeline → Punkte
  erscheinen. Ein Mapping-Fix entfernt den Eintrag aus der Review-Liste.

### M11 · Heim-Rechner-Betrieb & Go-live
- Scheduler, systemd/launchd, `scraper/README.md`, `docs/betrieb.md` (Taktung,
  Schutzmechanismen, Troubleshooting-Tabelle), Frische-Banner, Versionsanzeige.
- Go-live-Checkliste: Env-Variablen gesetzt, Deploy-Key, PAT, VAPID, Worker-Secret,
  Domain, Einladungscodes, Test-Durchlauf eines kompletten Spieltags im „Schattenbetrieb“
  (Punkte berechnen, aber noch nicht werten).
- **Abnahme:** Ein realer Spieltag läuft ohne manuelles Eingreifen durch: vorläufige
  Punkte ≤ 60 Min. nach Abpfiff, Finalisierung am Folgetag, Pushes kommen an.
  Danach `reuse/` löschen.

---

## 14 · Tests & Qualität
- **core:** Vitest, jede Regel mit positivem und negativem Fall, die Beispiele aus 3.5/4.x
  wörtlich. Echte Sofascore-Fixtures (M2) als Regressionstests.
- **pipeline:** Snapshot-Tests `raw-fixture → data` (deterministisch, feste Uhr).
- **app:** Route-Tests mit In-Memory-Storage (Workgrid-Muster: lokales Backend ohne
  Redis-Env), Guard-Test, Playwright für die Kern-Flows (M5–M7).
- **scraper:** pytest für Zeitplanung und Pacing (keine echten Abrufe in Tests).
- Lint/Format: ESLint + Prettier wie in den Altprojekten. `sonarjs` (WM-Tipp) ist optional.

---

## 15 · Betrieb, Kosten, Konfiguration

### 15.1 Kosten (alle im Gratis-Tarif)
Vercel Hobby (nur private, nicht-kommerzielle Nutzung), Upstash Redis Free
(500 K Befehle/Monat, 256 MB), Cloudflare Workers Free, GitHub privates Repo
(Actions ~2.000 Min./Monat inkl.; Bedarf ≈ 60 Läufe × 1–2 Min.), OpenLigaDB frei.
Strom für den Heim-Rechner.

### 15.2 Umgebungsvariablen
| Variable | Wo | Zweck |
|---|---|---|
| `AUTH_SECRET` | Vercel | NextAuth |
| `APP_ENCRYPTION_SECRET` | Vercel | AES-GCM der Redis-Dokumente |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel | Storage + Rate-Limit |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel | Push |
| `CRON_SECRET` | Vercel + Cloudflare-Secret | Tick-Schutz |
| `ADMIN_EMAILS` | Vercel | Admin-Rolle |
| `GITHUB_PAT`, `GITHUB_REPO` | Vercel | Admin-Commits, Dispatch |
| Deploy-Key (SSH) | Heim-Rechner | Push nach `raw/` |

### 15.3 Domain
Vorschlag `flutlicht.a-tec.dev` (wie die anderen Projekte), Umleitung von
`*.vercel.app` nach dem Workgrid-Muster in `middleware.ts`.

### 15.4 Rechtliches (Kurzfassung, keine Rechtsberatung)
Private, geschlossene Nutzung. Die Sofascore- und Transfermarkt-Daten sowie Bilder
werden nicht öffentlich ausgeliefert. Scraping sparsam gemäß 5.6. Die App enthält
Impressum/Datenschutz-Minimalseite mit Nennung der OpenLigaDB. Personenbezogene
Daten der Manager: E-Mail, Anzeigename, Passwort-Hash, Push-Subscription.
Konto löschen ist über den Admin möglich.

---

## 16 · Annahmen & bewusst gesetzte Standards

Nicht explizit besprochene Punkte. Sie gelten, bis Alex sie ändert. Änderungen
trägst du in `docs/entscheidungen.md` ein.

1. Nachholspiele werden nicht gewertet (2.9, Frist 3 Tage).
2. Tie-Break Gesamttabelle: Spieltagssiege → bester Einzelspieltag.
3. Zu null und Gegentore beziehen sich auf das ganze Spiel und setzen ≥ 60 Min. voraus
   (Vereinfachung ohne Minutengenauigkeit).
4. Transfers nur zwischen Finalisierung und erster Sperre, während des Spieltags
   nur Aufstellungsänderungen.
5. Der Transferabzug zählt für den Spieltag, für den gewechselt wurde.
6. Fremde Aufstellungen werden je Spieler ab dessen Sperre sichtbar.
7. Rundung: pro Spieler und Spiel ganzzahlig (half away from zero), Preise auf 0,1 Mio.
8. Erwartungswert für neue Spieler: 4 Punkte je Position (nach Kalibrierung anpassen).
9. Preis-Obergrenze nach Dynamik: 30 Mio. (Startpreise ≤ 25).
10. Sofascore-Marktwert als Fallback vor der manuellen Eingabe (4.1).
11. Passwort mindestens 10 Zeichen. Reset nur über einen Admin-Code, keine Mails.
12. Arbeitsdomain `flutlicht.a-tec.dev`.
13. Maximal ~20 Manager. Keine Caches oder Datenbank-Indizes nötig.
