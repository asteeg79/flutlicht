"""Feste Einstellungen des Scrapers (KONZEPT 5.2, 5.5, 5.6)."""

import os
from pathlib import Path

API = "https://api.sofascore.com/api/v1"
IMAGE_API = "https://api.sofascore.app/api/v1"
TOURNAMENT_ID = 35
SEASON_ID = 97464

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "raw"
STATE_DIR = Path(os.environ.get("FM_SCRAPER_STATE", Path.home() / ".fm-scraper"))

# Zufälliger Abstand zwischen zwei Abrufen innerhalb eines Jobs.
PACING_SECONDS = (8.0, 20.0)
# Nach 429 oder wiederholtem 403: so lange keine Abrufe.
PAUSE_HOURS = 6
# Keine Abrufe in diesen Stunden (Europe/Berlin), Ende exklusiv.
NIGHT_HOURS = (0, 7)
TIMEZONE = "Europe/Berlin"
REQUEST_TIMEOUT_SECONDS = 30
