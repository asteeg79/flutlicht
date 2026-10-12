"""Job match-final: lineups + incidents aller beendeten Spiele eines Spieltags (2 × 9 Abrufe).

Liest die Event-IDs aus der Datei von round-events. Mit `event_id` nur dieses Spiel.
Beendet ist ein Spiel laut Rundendatei oder laut `data/fixtures.json`: Die Rundendatei
stammt meist vom Dienstag vor dem Spieltag und nennt dann alle Spiele `notstarted`.
Spiele, deren Final-Dateien schon vorliegen, werden übersprungen: Der Job ist nach
einem Abbruch wiederaufnehmbar und der Backfill ruft nichts doppelt ab.
"""

import json
from pathlib import Path

from .. import config
from ..client import Client
from ..raw import read_raw, write_raw
from .round_events import round_path

PHASE = "final"


def _finished_in_fixtures(raw_dir: Path, matchday: int) -> set[int]:
    path = raw_dir.parent / "data" / "fixtures.json"
    if not path.exists():
        return set()
    return {
        f["sofascoreEventId"]
        for f in json.loads(path.read_text(encoding="utf-8"))
        if f["matchday"] == matchday and f["status"] == "finished"
    }


def run(client: Client, raw_dir: Path, matchday: int, event_id: int | None = None) -> list[Path]:
    rpath = round_path(raw_dir, matchday)
    if not rpath.exists():
        raise SystemExit(f"{rpath} fehlt, zuerst round-events für Spieltag {matchday} ausführen")
    finished = _finished_in_fixtures(raw_dir, matchday)
    events = [
        e
        for e in read_raw(rpath)["events"]
        if (e["status"]["type"] == "finished" or e["id"] in finished) and event_id in (None, e["id"])
    ]
    if event_id is not None and not events:
        raise SystemExit(f"Event {event_id} ist an Spieltag {matchday} nicht beendet oder unbekannt")
    if not events:
        raise SystemExit(f"Spieltag {matchday}: kein beendetes Spiel in {rpath.name} und data/fixtures.json")
    written: list[Path] = []
    for event in events:
        match_dir = raw_dir / "sofascore" / "matches" / str(event["id"]) / PHASE
        if (match_dir / "incidents.json").exists():
            continue
        for kind in ("lineups", "incidents"):
            url = f"{config.API}/event/{event['id']}/{kind}"
            path = match_dir / f"{kind}.json"
            write_raw(path, url, PHASE, client.get_json(url))
            written.append(path)
    return written
