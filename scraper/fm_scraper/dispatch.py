"""Die eine Weiche für CLI und Scheduler: Jobname → Aufruf des Jobs."""

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from . import config
from .client import Client
from .jobs import backfill, dcaribou, images, match_final, match_provisional, round_events, squads, tm_crawl
from .teams import load_teams

JOBS = ("round-events", "match-provisional", "match-final", "backfill", "squads", "dcaribou", "tm-crawl", "images")
NEEDS_MATCHDAY = {"round-events", "match-final", "backfill"}


def run_job(
    job: str, client: Client, raw: Path, matchday: int | None = None, event: int | None = None
) -> tuple[list[Path], bool]:
    """Führt einen Job aus. Rückgabe: geschriebene Dateien und ob das Spiel fertig ist
    (nur match-provisional kann False melden, dann ist ein neuer Versuch fällig)."""
    if job in NEEDS_MATCHDAY and matchday is None:
        raise SystemExit(f"{job} braucht --matchday")
    today = datetime.now(ZoneInfo(config.TIMEZONE)).date()
    match job:
        case "round-events":
            return round_events.run(client, raw, matchday), True
        case "match-provisional":
            if event is None:
                raise SystemExit("match-provisional braucht --event")
            return match_provisional.run(client, raw, event)
        case "match-final":
            return match_final.run(client, raw, matchday, event), True
        case "backfill":
            return backfill.run(client, raw, matchday), True
        case "squads":
            return squads.run(client, raw, load_teams(config.TEAMS_FILE), today), True
        case "dcaribou":
            return dcaribou.run(client, raw), True
        case "tm-crawl":
            return tm_crawl.run(client, raw, today), True
        case "images":
            return images.run(client, raw, config.IMG_DIR, load_teams(config.TEAMS_FILE)), True
    raise SystemExit(f"unbekannter Job: {job}")


def commit_paths(job: str) -> tuple[str, ...]:
    """Was nach dem Job committet wird: Bilder liegen zusätzlich in der App."""
    return ("app/public/img", "raw") if job == "images" else ("raw",)
