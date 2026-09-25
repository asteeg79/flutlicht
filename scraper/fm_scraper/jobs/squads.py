"""Job squads: Kader aller 18 Vereine (18 Abrufe, KONZEPT 5.5).

Ablage nach Datum (Europe/Berlin). Heute schon geholte Vereine werden übersprungen,
der Job ist also nach einem Abbruch wiederaufnehmbar.
"""

from datetime import date
from pathlib import Path

from .. import config
from ..client import Client
from ..raw import write_raw


def run(client: Client, raw_dir: Path, teams: list[dict], today: date) -> list[Path]:
    day_dir = raw_dir / "sofascore" / "squads" / today.isoformat()
    written: list[Path] = []
    for team in teams:
        path = day_dir / f"{team['id']}.json"
        if path.exists():
            continue
        url = f"{config.API}/team/{team['id']}/players"
        write_raw(path, url, "squad", client.get_json(url))
        written.append(path)
    return written
