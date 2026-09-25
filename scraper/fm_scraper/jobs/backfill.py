"""Job backfill: bereits gespielter Spieltag nachholen (KONZEPT 5.5).

Pro Aufruf genau ein Spieltag (1 + 2 × 9 Abrufe), damit sich der Backfill über
mehrere Tage verteilen lässt. Vorhandene Dateien werden nicht erneut abgerufen.
"""

from pathlib import Path

from ..client import Client
from . import match_final, round_events


def run(client: Client, raw_dir: Path, matchday: int) -> list[Path]:
    written: list[Path] = []
    if not round_events.round_path(raw_dir, matchday).exists():
        written += round_events.run(client, raw_dir, matchday)
    return written + match_final.run(client, raw_dir, matchday)
