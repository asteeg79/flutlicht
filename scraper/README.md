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
parallel, wechselt nur bei 403 oder Bot-Challenge auf den Browser, pausiert nach
429 oder wiederholtem 403 für 6 h und ruft zwischen 00 und 07 Uhr nichts ab. Die
Pause steht in `~/.fm-scraper/state.json` (tm-crawl: `tm-state.json`).

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

Für den Browser-Modus braucht botasaurus ein Chromium (Pi: `sudo apt install chromium`).

**3a. Timer auf dem Pi (systemd, Benutzer-Units):**

```sh
mkdir -p ~/.config/systemd/user
cp deploy/flutlicht-scraper.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now flutlicht-scraper.timer
sudo loginctl enable-linger "$USER"      # läuft auch ohne Anmeldung
journalctl --user -u flutlicht-scraper -f  # Log
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

**Stoppen:** `systemctl --user disable --now flutlicht-scraper.timer` bzw.
`launchctl unload ~/Library/LaunchAgents/dev.a-tec.flutlicht.scraper.plist`.

## Zustand

| Datei (`~/.fm-scraper/`, änderbar per `FM_SCRAPER_STATE`) | Inhalt |
|---|---|
| `scheduler.json` | gezogene Zeitpunkte (`planned`), erledigte Jobs (`done`), Fehlversuche, letzter `git pull` |
| `state.json` / `tm-state.json` | 6-h-Pause nach 429/403 (Sofascore bzw. Transfermarkt) |
| `scheduler.lock` | verhindert zwei gleichzeitige Läufe |

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
