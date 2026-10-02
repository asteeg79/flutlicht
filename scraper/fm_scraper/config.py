"""Feste Einstellungen des Scrapers (KONZEPT 5.2, 5.5, 5.6)."""

import os
from pathlib import Path

# Die API unter dem Host der Website: api.sofascore.com weist seit dem 30.09.2026 alle ab.
SITE = "https://www.sofascore.com/"
API = "https://www.sofascore.com/api/v1"
TOURNAMENT_ID = 35
SEASON_ID = 97464

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "raw"
IMG_DIR = REPO_ROOT / "app" / "public" / "img"
TEAMS_FILE = RAW_DIR / "manual" / "teams.json"
STATE_DIR = Path(os.environ.get("FM_SCRAPER_STATE", Path.home() / ".fm-scraper"))

# Zufälliger Abstand zwischen zwei Abrufen innerhalb eines Jobs.
PACING_SECONDS = (8.0, 20.0)
# Nach 429 oder wiederholtem 403: so lange keine Abrufe.
PAUSE_HOURS = 6
# Keine Abrufe in diesen Stunden (Europe/Berlin), Ende exklusiv.
NIGHT_HOURS = (0, 7)
TIMEZONE = "Europe/Berlin"
REQUEST_TIMEOUT_SECONDS = 30

# Lebenszeichen an die eigene App (heartbeat.py), kein Sofascore-Abruf.
HEARTBEAT_URL = "https://flutlicht.a-tec.dev/api/scraper/heartbeat"
HEARTBEAT_TIMEOUT_SECONDS = 10

# dcaribou-Datensatz (CC0), Stand 12.06.2026 (KONZEPT 5.4).
DCARIBOU_URL = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz"
# Lokaler transfermarkt-api-Dienst (Docker) und sein Abrufabstand.
TM_API = os.environ.get("FM_TM_API", "http://localhost:8000")
TM_PACING_SECONDS = (60.0, 180.0)
# Bilder: höchstens so viele pro Lauf, Läufe höchstens stündlich (KONZEPT 5.5).
IMAGES_PER_RUN = 60
IMAGE_SIZE = 128
