# Betrieb: Flutlicht

Alle automatischen Abläufe, ihre Taktung und Schutzmechanismen und was zu tun ist,
wenn etwas hängt. Gliederung nach WM-Tipp `docs/betrieb.md`. Einrichtung des
Heim-Rechners: [`scraper/README.md`](../scraper/README.md).

## Datenarten und Aktualitätsbedarf

| Datenart | Quelle | Zeitkritik | Mechanismus |
|---|---|---|---|
| Spielplan, Anstoßzeiten, Endstand | OpenLigaDB | mittel | `fixtures.yml` (GitHub-Cron) |
| Event-IDs eines Spieltags | Sofascore `round` | niedrig | Scheduler `round-events`, Di 10–14 Uhr |
| Vorläufige Punkte | Sofascore lineups + incidents | **hoch** (≤ 60 Min. nach Abpfiff) | Scheduler `match-provisional`, Anpfiff + 135–155 Min. |
| Finale Punkte, Preise | Sofascore, dann Pipeline | mittel (Folgetag) | Scheduler `match-final`, 08–10 Uhr am Folgetag |
| Kader, Positionen | Sofascore `team/players` | niedrig | Scheduler `squads`, montags und donnerstags (Jan., Juli, Aug. alle 2 Tage) |
| Bilder | Sofascore | niedrig | Scheduler `images`, höchstens stündlich, ≤ 60 je Lauf |
| Marktwerte | transfermarkt-api (lokal), dcaribou | einmal pro Saison | `tm-crawl`/`dcaribou` von Hand |
| Erinnerungen, Finalisierung, Pushes | App-Zustand + `data/` | mittel | Cloudflare-Worker → `/api/cron/tick` alle 10 Min. |

## Taktung: wer stößt was an

```
Heim-Rechner (Timer 5 Min.) ── Job ── git push raw/ ──▶ compute.yml ── data/ ──▶ Vercel-Build
GitHub-Cron ── fixtures.yml (OpenLigaDB + pipeline build) ── data/ ──────────────▶ Vercel-Build
Cloudflare-Worker (*/10) ── POST /api/cron/tick ──▶ App (Finalisierung, Pushes)
Heim-Rechner (jeder Lauf) ── POST /api/scraper/heartbeat ──▶ App (Lebenszeichen)
```

- **Scheduler** (`scraper/fm_scraper/scheduler.py`): wird alle 5 Min. aufgerufen,
  entscheidet rein lokal und erzeugt nur dann Abrufe, wenn ein Job fällig ist. Er
  liest `data/fixtures.json` aus dem lokalen Klon (`git pull` höchstens alle 30 Min.).
  Zufällige Zeitpunkte werden einmal pro Job gezogen und in `~/.fm-scraper/scheduler.json`
  gespeichert. Nachts (00–07 Uhr) läuft nichts; fällt ein Zeitpunkt in die Nacht,
  wird er auf 07:05–07:35 verschoben.
- **`compute.yml`**: startet bei jedem Push nach `raw/**` (Deploy-Key des Scrapers,
  Admin-Commits), per `workflow_dispatch` und per `repository_dispatch`
  (Neuberechnung aus `/admin`).
- **`fixtures.yml`**: täglich 05:17 UTC, Fr–So 11–22 Uhr UTC und Di/Mi 16–22 Uhr UTC
  stündlich um :23. Holt OpenLigaDB, rechnet `data/` im selben Lauf neu (Pushes per
  `GITHUB_TOKEN` lösen `compute.yml` nicht aus) und meldet überfällige Spiele.
- **Cloudflare-Worker** `flutlicht-cron` (`infra/cron-worker/`): exakter Cron
  `*/10 * * * *`, ruft den idempotenten Tick. Vercel Hobby kann das nicht selbst.
- **Vercel** baut bei jedem Commit, der `app/`, `core/`, `data/` oder das Lockfile
  ändert (Ignored Build Step, KONZEPT 6.4).

### Zeitbudget vorläufige Punkte

Abpfiff ≈ Anpfiff + 110 Min. → Abruf bei + 135–155 Min. (20–45 Min. nach Abpfiff)
→ `compute.yml` ~1 Min. → Vercel-Build ~2 Min. Ist das Spiel beim Abruf noch nicht
beendet (kein Incident `period`/`FT`), versucht der Scheduler es nach 15 Min. erneut,
höchstens 3-mal.

## Jobs

| Wo | Job | Trigger | Aufgabe |
|---|---|---|---|
| Heim-Rechner | `round-events` | Di 10–14 Uhr vor dem nächsten Spieltag (auch später nachgeholt) | Event-IDs |
| Heim-Rechner | `match-provisional` | Anpfiff + 135–155 Min., bis 24 h nach Anpfiff | vorläufige Daten eines Spiels |
| Heim-Rechner | `match-final` / `backfill` | Folgetag nach dem letzten Spiel 08–10 Uhr; höchstens ein Spieltag pro Tag | finale Daten aller Spiele |
| Heim-Rechner | `squads` | montags und donnerstags 10–18 Uhr, im Transferfenster alle 2 Tage | Kader |
| Heim-Rechner | `images` | fehlende Bilder, stündlich | Logos, Spielerfotos |
| GitHub | `compute` | Push `raw/**`, Dispatch | `pipeline build` → `data/` |
| GitHub | `fixtures` | Cron (s. o.) | OpenLigaDB, `pipeline build`, Überfällig-Alarm |
| GitHub | `ci` | Push/PR auf Code | lint, typecheck, test, pytest |
| GitHub | `_alert` | `failure()` von `compute`/`fixtures` | Issue `pipeline-failure` (dedupliziert) |
| Cloudflare | `flutlicht-cron` | alle 10 Min. | `/api/cron/tick` |

## Schutzmechanismen

1. **Scraping-Regeln (KONZEPT 5.6)** stecken im Client (`client.py`), nicht im
   Scheduler: 8–20 s Abstand, keine Parallelität, Abruf im Browser mit Rückfall
   auf den nächsten Abrufweg bei 403/Challenge (`direct` → `page` → `window`),
   6 h Pause nach 429 oder wenn alle Wege gesperrt sind, keine Abrufe 00–07 Uhr,
   auch nicht bei manuellem Start.
2. **Ein Lauf zur Zeit:** `scheduler.lock` (flock); ein zweiter Aufruf endet sofort.
3. **Aufgeben statt Dauerschleife:** Ein Job, der 3-mal scheitert (oder ein Spiel,
   das nach 3 Versuchen nicht beendet ist), gilt als erledigt; die Lücke füllt
   `match-final` bzw. der Admin.
4. **Sanity-Guard** (`pipeline/src/steps/sanity.ts`): offensichtlich kaputte Daten
   brechen den Build ab, `data/` bleibt beim letzten guten Stand.
5. **Concurrency-Gruppe `data-pipeline`** (`cancel-in-progress: false`) und Rebase
   vor jedem Push (Scraper: 3 Versuche): keine verlorenen Commits bei gleichzeitigen Läufen.
6. **Überfällig-Alarm:** Spiele, die seit > 3 h beendet sind und keine Daten haben
   (bis 72 h nach Anpfiff), machen `fixtures.yml` rot → Issue. Ältere Lücken stehen
   in `data/review/manual-needed.json` und in `/admin`.
7. **Frische-Banner in der App:** Ein Spiel ist seit > 90 Min. beendet und hat noch
   keine Daten → „Daten ausstehend für …“.
8. **Versionsanzeige und Update-Hinweis:** Einstellungen zeigen Version (Commit-
   Zeitstempel), Commit und Build-Datum; die App fragt alle 5 Min. `/version.json`
   ab und bietet „Neu laden“ an, sobald ein neuerer Build (Code oder Daten) live ist.
9. **Tick idempotent:** Schlüssel in `system-state`, jeder Push höchstens einmal.
10. **Scraper-Lebenszeichen:** Der Scheduler meldet sich bei jedem Lauf (alle 5 Min.,
    auch nachts) und nach jedem Job bei der App (`heartbeat.py`, Secret in
    `~/.fm-scraper/heartbeat-secret`). `/admin` → Status zeigt den Zeitpunkt. Bleibt
    die Meldung länger als 45 Min. aus, schickt der Tick den Admins einmal je Ausfall
    einen Push. Fällt der Worker oder die App aus, kommt auch kein Alarm.
11. **Scraper-Stand:** Mit dem Lebenszeichen schickt der Scheduler seinen Stand:
    laufende 6-h-Pause mit Grund, letzter Job mit Ergebnis und Fehlertext, fällige
    Jobs mit Fehlversuchen, die nächsten geplanten Jobs, aufgegebene Jobs der letzten
    7 Tage, Commit des Klons und nicht gepushte Commits. `/admin` → Status zeigt das.
    Der Tick schickt den Admins einen Push je begonnener Pause und je aufgegebenem
    Job. Das Lebenszeichen zu Beginn eines Laufs zeigt die fälligen Jobs des vorigen
    Laufs (5 Min. alt). Der Stand kommt vom Heim-Rechner selbst: Ob die Daten wirklich
    da sind, zeigen weiter Frische-Banner und Überfällig-Alarm.

## Soforthilfe

```sh
# Heim-Rechner: einen Job sofort ausführen (committet und pusht)
cd ~/flutlicht/scraper
.venv/bin/python -m fm_scraper run match-provisional --event 16434032
.venv/bin/python -m fm_scraper run match-final --matchday 9

# GitHub: data/ neu rechnen bzw. Spielplan holen
gh workflow run compute.yml
gh workflow run fixtures.yml

# Worker-Logs
cd infra/cron-worker && npx wrangler tail
```

## Troubleshooting

| Symptom | Prüfen | Ursache / Behebung |
|---|---|---|
| Push „Scraper meldet sich nicht“ bzw. `/admin` → Scraper-Lebenszeichen rot | `ssh raspdev 'systemctl --user list-timers flutlicht-scraper.timer'`; Log nach „Lebenszeichen fehlgeschlagen“ durchsuchen | Heim-Rechner aus oder ohne Netz → einschalten. Timer gestoppt → `systemctl --user enable --now flutlicht-scraper.timer`. HTTP 401 im Log → `SCRAPER_SECRET` in Vercel und `~/.fm-scraper/heartbeat-secret` verschieden. HTTP 400 im Log → App und Klon haben verschiedene Code-Stände (Stand des Lebenszeichens passt nicht zum Schema): `git -C ~/flutlicht pull` bzw. App deployen |
| Push „Scraper pausiert“ bzw. `/admin` → Scraper-Pause | Grund steht in der Zeile; `ssh raspdev 'cat ~/.fm-scraper/state.json'` | 429/403 von Sofascore; 6 h abwarten, **nicht** umgehen. Bei einer Sperre über Tage kommt je Pause ein Push |
| `/admin` → Abrufweg rot („Rückfall: …“) | Scheduler-Log nach „wechsle auf den Abrufweg“ | Sofascore hat den direkten Abruf gesperrt, der Rückfall arbeitet. Kein Eingriff nötig; zurück auf `direct`: `route` aus `~/.fm-scraper/state.json` löschen. Pause mit „Abrufweg „window“ startet nicht“ → Xvfb fehlt (`sudo apt install xvfb`) |
| Push „Scraper-Job aufgegeben“ bzw. `/admin` → Aufgegebene Jobs | `/admin` → Letzter Job (Fehlertext); Scheduler-Log | Job nach 3 Versuchen aufgegeben → von Hand starten (Soforthilfe) oder in `/admin` nachtragen |
| `/admin` → Stand Heim-Rechner „nicht gepusht“ | `git -C ~/flutlicht status`, `ssh -T git@github-flutlicht` | Push gescheitert, die Rohdaten liegen nur auf dem Heim-Rechner → `git -C ~/flutlicht pull --rebase && git -C ~/flutlicht push` |
| `/admin` → Scraper-Lebenszeichen „noch keines“ | Gibt es `~/.fm-scraper/heartbeat-secret` auf dem Heim-Rechner? | Secret-Datei fehlt: ohne sie meldet sich der Scheduler nicht (Einrichtung in `scraper/README.md`) |
| Frische-Banner bleibt stehen | Scheduler-Log (`journalctl --user-unit flutlicht-scraper` bzw. `scraper/scraper.log`); `~/.fm-scraper/scheduler.json` → `done`/`attempts` für `prov:<event>` | Heim-Rechner aus/offline → einschalten, Job von Hand starten. 6-h-Pause in `state.json` → abwarten |
| Keine vorläufigen Daten, obwohl Scheduler läuft | Hat die Fixture eine `sofascoreEventId`? (`data/fixtures.json`) | `round-events` fehlt → `run round-events --matchday N` |
| „Pause bis …“ im Log | `~/.fm-scraper/state.json` | 429/403 von Sofascore; 6 h abwarten, **nicht** umgehen |
| Push vom Scraper scheitert | `git -C ~/flutlicht status`, `ssh -T git@github-flutlicht` | Deploy-Key fehlt/ohne Schreibrecht; Rebase-Konflikt → `git rebase --abort`, `git pull` |
| Issue `pipeline-failure` | `gh run view <id> --log-failed` | Sanity-Guard oder Schema-Fehler in `raw/`; Rohdatei korrigieren oder Admin-Nachtrag |
| Spieltag wird nicht final | `/admin` → Status; `data/fixtures.json` → `dataState` | `match-final` aufgegeben → von Hand starten oder in `/admin` nachtragen |
| Keine Erinnerungen/Fazits | `npx wrangler tail`; `/admin` → letzter Tick | `CRON_SECRET` in Worker und Vercel verschieden, `APP_URL` falsch |
| App zeigt alten Stand | Einstellungen → Version/Commit; Vercel-Deployments | Build übersprungen (Ignored Build Step) oder rot; neu laden |
| Scheduler startet nicht (Mac) | `launchctl list \| grep flutlicht`, `scraper/scraper.log` | Pfad in der Plist falsch (REPO_DIR), Mac im Ruhezustand |
