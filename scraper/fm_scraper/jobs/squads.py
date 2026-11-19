"""Job squads: Kader aller 18 Vereine (18 Abrufe, KONZEPT 5.5).

Ablage nach Datum (Europe/Berlin), gzip-komprimiert (`{teamId}.json.gz`). Heute schon geholte Vereine werden übersprungen,
der Job ist also nach einem Abbruch wiederaufnehmbar.
"""

from datetime import date
from pathlib import Path

from .. import config
from ..client import Client
from ..raw import write_raw
from ..teams import load_teams


def _path(raw_dir: Path, day: str, team_id: int) -> Path:
    # int(): Die ID kommt aus teams.json und landet im Pfad und in der URL.
    return raw_dir / "sofascore" / "squads" / day / f"{int(team_id)}.json.gz"


def _complete(raw_dir: Path, day: str) -> bool:
    """Hat jeder Verein aus teams.json einen Stand an diesem Tag? Nach einem Abbruch nicht."""
    teams_file = raw_dir / config.TEAMS_FILE.relative_to(config.RAW_DIR)
    if not teams_file.exists():
        return False
    return all(_path(raw_dir, day, team["id"]).exists() for team in load_teams(teams_file))


def fetched_since(raw_dir: Path, day: date) -> bool:
    """Gibt es ab `day` einen vollständigen Stand (auch von Hand geholt)? Ein abgebrochener
    zählt nicht: Der Job holt dann nur die fehlenden Vereine."""
    snapshots = raw_dir / "sofascore" / "squads"
    return snapshots.exists() and any(
        p.is_dir() and p.name >= day.isoformat() and _complete(raw_dir, p.name) for p in snapshots.iterdir()
    )


def run(client: Client, raw_dir: Path, teams: list[dict], today: date) -> list[Path]:
    written: list[Path] = []
    for team in teams:
        path = _path(raw_dir, today.isoformat(), team["id"])
        if path.exists():
            continue
        url = f"{config.API}/team/{int(team['id'])}/players"
        write_raw(path, url, "squad", client.get_json(url))
        written.append(path)
    return written
