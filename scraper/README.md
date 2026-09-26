# fm_scraper

Holt Rohdaten für Flutlicht nach `raw/` (KONZEPT 5, 10). Die vollständige
Betriebsanleitung (Scheduler, Deploy-Key, Timer) folgt in M11.

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

## transfermarkt-api (für `tm-crawl`, einmal pro Saison)

```sh
git clone https://github.com/felipeall/transfermarkt-api.git   # MIT
cd transfermarkt-api
docker build -t transfermarkt-api .
docker run -d --name fm-tm-api -p 127.0.0.1:8000:8000 transfermarkt-api
# … tm-crawl ausführen, danach:
docker rm -f fm-tm-api
```
