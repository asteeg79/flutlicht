# fm_scraper

Holt Rohdaten für Flutlicht nach `raw/` (KONZEPT 5, 10). Im Betrieb ruft ein
Timer alle 5 Min. `python -m fm_scraper schedule` auf; der Scheduler entscheidet
lokal, ob ein Job fällig ist. Taktung, Schutzmechanismen und Fehlersuche stehen in
[`docs/betrieb.md`](../docs/betrieb.md).

## Einrichten

```sh
cd scraper
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m pytest -q     # ohne Netzwerk
```

## Jobs von Hand starten

```sh
.venv/bin/python -m fm_scraper run <job> [--matchday N] [--event ID] [--no-sync]
```

| Job | Abrufe | Zweck |
|---|---|---|
| `round-events --matchday N` | 1 | Event-IDs eines Spieltags |
| `match-provisional --event ID` | 2 | vorläufige lineups + incidents eines Spiels |
| `match-final --matchday N [--event ID]` | 2 je Spiel | lineups + incidents aller beendeten Spiele |
| `backfill --matchday N` | 1 + 2 × 9 | bereits gespielten Spieltag nachholen; **höchstens einen pro Aufruf**, über 2–3 Tage verteilen |
| `squads` | 18 | Kader aller Vereine aus `raw/manual/teams.json` |
| `dcaribou` | 1 | Transfermarkt-Datensatz (CC0), gefiltert auf die Bundesliga |
| `tm-crawl` | 19 | Marktwerte über den lokalen transfermarkt-api-Dienst (60–180 s Abstand) |
| `images` | ≤ 60 | Logos und Spielerbilder als 128-px-WebP nach `app/public/img/`; höchstens stündlich |

Ohne `--no-sync` committet und pusht der Job danach (`raw/` bzw. bei `images`
`app/public/img/`). Vorhandene Dateien werden nicht erneut abgerufen.

Scraping-Regeln (KONZEPT 5.6): Der Client hält 8–20 s Abstand, arbeitet nie
parallel, pausiert nach 429 oder wenn alle Abrufwege gesperrt sind für 6 h und ruft
zwischen 00 und 07 Uhr nichts ab. Die Pause steht in `~/.fm-scraper/state.json`
(tm-crawl: `tm-state.json`).

Abrufwege: Alle Sofascore-Abrufe laufen im Browser über `www.sofascore.com/api/v1`.
Bei 403 oder Bot-Challenge wechselt der Client auf den nächsten Weg und bleibt dort:

| Weg | Was er tut |
|---|---|
| `direct` | headless Chromium ruft die API-URL direkt auf |
| `page` | lädt einmal die Startseite und holt die Daten per `fetch` aus der Seite; festes Profil in `~/.fm-scraper/browser-profile` |
| `window` | wie `page`, aber mit Fenster statt headless; auf dem Pi in einem virtuellen Display (Xvfb) |

Der aktuelle Weg steht als `route` in `state.json` und in `/admin` → Status
(„Abrufweg“). Zurück auf `direct`: `route` aus `state.json` löschen. Solange ein
Rückfallweg das feste Profil nutzt, darf kein zweiter Job von Hand laufen.

## Heim-Rechner einrichten

**1. Deploy-Key** (Schreibrecht nur auf dieses Repo):

```sh
ssh-keygen -t ed25519 -f ~/.ssh/flutlicht_deploy -N "" -C "flutlicht-scraper"
cat ~/.ssh/flutlicht_deploy.pub
# GitHub → asteeg79/flutlicht → Settings → Deploy keys → Add, „Allow write access“ an
cat >> ~/.ssh/config <<'CFG'
Host github-flutlicht
  HostName github.com
  IdentityFile ~/.ssh/flutlicht_deploy
  IdentitiesOnly yes
CFG
```

**2. Klon und venv** (Pi: nach `~/flutlicht`, so erwartet es die systemd-Unit):

```sh
git clone git@github-flutlicht:asteeg79/flutlicht.git ~/flutlicht
cd ~/flutlicht
git config user.name "Flutlicht-Scraper"
git config user.email "scraper@flutlicht.invalid"
cd scraper
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python -m fm_scraper schedule   # einmal von Hand: Pull, Plan, ggf. Job
```

Alle Abrufe laufen im Browser: botasaurus braucht ein Chromium, der Abrufweg `window`
zusätzlich Xvfb (Pi: `sudo apt install chromium xvfb`). Ohne Xvfb endet die Kette
nach `page` mit der 6-h-Pause.

**3a. Timer auf dem Pi (systemd, Benutzer-Units):**

```sh
mkdir -p ~/.config/systemd/user
cp deploy/flutlicht-scraper.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now flutlicht-scraper.timer
sudo loginctl enable-linger "$USER"      # läuft auch ohne Anmeldung
journalctl --user-unit flutlicht-scraper -f   # Log (Benutzer in der Gruppe adm)
```

**3b. Timer auf dem Mac (launchd):**

```sh
sed "s#REPO_DIR#$HOME/flutlicht#g" deploy/dev.a-tec.flutlicht.scraper.plist \
  > ~/Library/LaunchAgents/dev.a-tec.flutlicht.scraper.plist
launchctl load ~/Library/LaunchAgents/dev.a-tec.flutlicht.scraper.plist
tail -f ~/flutlicht/scraper/scraper.log   # Log
```

Der Mac darf nicht schlafen (Systemeinstellungen → Energie: „Ruhezustand
verhindern“) oder `caffeinate -s` im Hintergrund.

**4. Lebenszeichen an die App** (optional, empfohlen): Der Scheduler meldet sich bei
jedem Lauf bei der App, sobald das Secret hinterlegt ist, und schickt seinen Stand mit
(Pause, letzter Job, fällige, geplante und aufgegebene Jobs, Git-Stand). `/admin` zeigt
die letzte Meldung; nach 45 Min. Stille, bei einer Pause und bei einem aufgegebenen Job
bekommen die Admins einen Push.

```sh
# Derselbe Wert wie SCRAPER_SECRET in Vercel (z. B. aus `openssl rand -hex 32`)
umask 077 && cat > ~/.fm-scraper/heartbeat-secret   # Wert einfügen, Enter, Strg+D
```

**Stoppen:** `systemctl --user disable --now flutlicht-scraper.timer` bzw.
`launchctl unload ~/Library/LaunchAgents/dev.a-tec.flutlicht.scraper.plist`.

## Zustand

| Datei (`~/.fm-scraper/`, änderbar per `FM_SCRAPER_STATE`) | Inhalt |
|---|---|
| `scheduler.json` | gezogene Zeitpunkte (`planned`), erledigte Jobs (`done`), Fehlversuche, letzter `git pull`; für das Lebenszeichen: fällige Jobs des letzten Laufs (`due`), letzter Job (`lastJob`), aufgegebene Jobs (`gaveUp`) |
| `state.json` / `tm-state.json` | 6-h-Pause nach 429/403 mit Grund (Sofascore bzw. Transfermarkt), Abrufweg, der zuletzt ging (`route`) |
| `browser-profile/` | festes Chromium-Profil der Abrufwege `page` und `window` (Cookies) |
| `scheduler.lock` | verhindert zwei gleichzeitige Läufe |
| `heartbeat-secret` | Bearer-Secret für das Lebenszeichen an die App; ohne die Datei meldet sich der Scheduler nicht |

Einen Job neu auslösen: seinen Schlüssel (z. B. `"final:9"`) aus `done` löschen,
oder den Job von Hand starten (unten).

## transfermarkt-api (für `tm-crawl`, einmal pro Saison)

```sh
git clone https://github.com/felipeall/transfermarkt-api.git   # MIT
cd transfermarkt-api
docker build -t transfermarkt-api .
docker run -d --name fm-tm-api -p 127.0.0.1:8000:8000 transfermarkt-api
# … tm-crawl ausführen, danach:
docker rm -f fm-tm-api
```
