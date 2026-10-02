# Sofascore-Felder (verifiziert in M2)

Stichprobe am 25.09.2026: Spieltag 1 der Saison 2026/27 (alle 9 Spiele, `final`,
in M3 ergänzt um Spieltag 2 aus dem Backfill),
Kader von Union Berlin, je ein Spieler- und Vereinsbild. Insgesamt 22 Abrufe im
`botasaurus.request`-Modus, ohne 403, 429 oder Bot-Challenge. Der Browser-Modus
war nicht nötig.

**Stand 02.10.2026:** `api.sofascore.com` weist seit dem 30.09. alle Clients mit 403
ab, auch ein normales Chrome. Dieselben Pfade unter `www.sofascore.com/api/v1` antworten
im Browser weiter (geprüft: Kader, Ereignisse, Spielerbild); der request-Modus läuft
auf beiden Hosts in eine Bot-Challenge. Die Bilder liegen ebenfalls unter
`www.sofascore.com/api/v1/…/image` (bis dahin `api.sofascore.app`).

Die Test-Fixtures liegen in `core/test/fixtures/sofascore/` (Kopien aus `raw/`).
Ausgewertet werden die Felder von `core/src/sofascore.ts`.

## Endpunkte

| Zweck | URL | Ergebnis |
|---|---|---|
| Spieltag | `www.sofascore.com/api/v1/unique-tournament/35/season/97464/events/round/{n}` | wie KONZEPT 5.2. Endstand in `homeScore.current` / `awayScore.current` |
| Aufstellungen | `…/event/{id}/lineups` | wie KONZEPT 5.2 |
| Ereignisse | `…/event/{id}/incidents` | siehe unten |
| Kader | `…/team/{id}/players` | **bestätigt.** `players[].player` mit `id, name, shortName, position (G/D/M/F), dateOfBirthTimestamp, dateOfBirth, proposedMarketValueRaw{value,currency}` (`dateOfBirth` als ISO-Zeitpunkt, z. B. 2002-02-28T00:00:00+00:00), zusätzlich `foreignPlayers`, `nationalPlayers`. Union: 30 Spieler |
| Spielerbild | `…/player/{id}/image` | **bestätigt**, WebP (~4 KB) |
| Vereinslogo | `…/team/{id}/image` | **bestätigt**, PNG (~5 KB) → wird für `app/public/img/clubs/` in WebP umgewandelt (6.3) |

## Aufstellungen (`lineups`)

- `players[i].player.position` ist die **Stammposition** des Spielers (G/D/M/F).
  `players[i].position` ist die Position **in diesem Spiel** und kann abweichen
  (Beispiel: Juranović, Stammposition M, spielte D). Gewertet wird die Saison-Position
  aus `players.json`; ohne sie greift `player.position`.
- `substitute: false` = reale Startelf (Startelf-Bonus 3.3).
- `statistics.minutesPlayed`, `statistics.rating`: fehlen bei Ersatzspielern ohne
  Einsatz vollständig → 0 Minuten, Note `null`.
- `statistics.goals`, `statistics.goalAssist` sind vorhanden und stimmen in der
  Stichprobe mit den Incidents überein. Es gibt **keine** Statistik-Schlüssel für
  Elfmeter oder Eigentore.

## Ereignisse (`incidents`)

Beobachtete Kombinationen `incidentType` / `incidentClass` am Spieltag 1:

| Typ | Klasse | Anzahl | Bedeutung für die Punkte |
|---|---|---|---|
| `goal` | `regular` | 34 | Tor für `player`, Vorlage für `assist1` |
| `goal` | `ownGoal` | 1 | Eigentor von `player`. **`isHome` bezeichnet das begünstigte Team**, nicht das des Spielers |
| `card` | `yellow` | 27 | Gelb. `rescinded: true` zählt nicht |
| `card` | `red` | 2 | Glatt Rot ✓ |
| `card` | `yellowRed` | 1 (Spieltag 2) | Gelb-Rot ✓, hier an einen Trainer |
| `card` ohne `player`, mit `manager` | `yellow`, `yellowRed` | 2 (Spieltag 2) | Karte an den Trainer → ignoriert |
| `inGamePenalty` | `missed` | 1 | Verschossen von `player`. Mit `reason: "goalkeeperSave"` steht der haltende Torwart in `footballPassingNetworkAction[]` mit `eventType: "penalty-save"` unter `goalkeeper.id` |
| `varDecision` | `goalAwarded`, `penaltyAwarded` | 4 | nur Info, das Tor bzw. der Elfmeter steht zusätzlich als eigener Incident drin → ignoriert. Im Fall `penaltyAwarded` (Event 16434101) folgte kein Elfmeter-Incident, die Entscheidung wurde offenbar zurückgenommen |
| `substitution` | `regular`, `injury` | 87 | ignoriert (Minuten kommen aus `lineups`) |
| `period`, `injuryTime` | – | 36 | ignoriert |

**Noch nicht beobachtet** (die Pipeline meldet unbekannte Klassen als Warnung):
- `goal` / `penalty` (verwandelter Elfmeter): In 18 Spielen kam die Klasse nicht vor;
  möglicherweise führt Sofascore verwandelte Elfmeter als `regular`. Für die Punkte ist
  das egal, beides zählt als Tor. Andere Tor-Klassen werden auch als Tor gewertet,
  lösen aber eine Warnung aus.
- `inGamePenalty` mit anderem `reason` als `goalkeeperSave` (etwa Pfosten oder
  vorbei): Er zählt nur als verschossen, niemand bekommt „gehalten“.

## Folgen für Tabelle 3.2

Keine Änderung an den Punktwerten nötig. Die Quellen in `core/src/sofascore.ts`:

| Ereignis | Quelle |
|---|---|
| Gegentore (zu null, je Gegentor ab dem 2.) | Endstand aus `round` bzw. `fixtures.json`, nicht aus den Incidents (wegen Eigentoren) |
| Elfmeter verschossen | `inGamePenalty` + `missed` |
| Elfmeter gehalten | dasselbe Incident, `reason: "goalkeeperSave"`, Torwart aus `footballPassingNetworkAction` |
| Vorlage | `assist1`; ist `statistics.goalAssist` höher, gilt die Statistik (mit Warnung) |
