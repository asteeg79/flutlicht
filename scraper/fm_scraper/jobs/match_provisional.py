"""Job match-provisional: vorläufige lineups + incidents eines Spiels (2 Abrufe, KONZEPT 5.5).

Überschreibt den vorigen vorläufigen Stand. Gibt zurück, ob das Spiel laut
Abpfiff-Incident (period/FT) beendet ist; sonst plant der Scheduler +15 Min. nach.
"""

from pathlib import Path

from .. import config
from ..client import Client
from ..raw import write_raw

PHASE = "provisional"


def run(client: Client, raw_dir: Path, event_id: int) -> tuple[list[Path], bool]:
    match_dir = raw_dir / "sofascore" / "matches" / str(event_id) / PHASE
    written: list[Path] = []
    finished = False
    for kind in ("lineups", "incidents"):
        url = f"{config.API}/event/{event_id}/{kind}"
        data = client.get_json(url)
        path = match_dir / f"{kind}.json"
        write_raw(path, url, PHASE, data)
        written.append(path)
        if kind == "incidents":
            finished = any(
                i.get("incidentType") == "period" and i.get("text") == "FT" for i in data.get("incidents", [])
            )
    return written, finished
