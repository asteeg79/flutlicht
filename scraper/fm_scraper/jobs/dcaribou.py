"""Job dcaribou: Transfermarkt-Datensatz (CC0) laden, auf die Bundesliga filtern (1 Abruf).

Ergebnis: raw/dcaribou/players-L1.csv mit allen Spalten des Originals.
"""

import csv
import gzip
import io
from pathlib import Path

from .. import config
from ..client import Client
from ..errors import JobError


def run(client: Client, raw_dir: Path) -> list[Path]:
    data = gzip.decompress(client.get_bytes(config.DCARIBOU_URL)).decode("utf-8")
    reader = csv.DictReader(io.StringIO(data))
    if reader.fieldnames is None:
        raise JobError("dcaribou: leere Datei")
    rows = [r for r in reader if r.get("current_club_domestic_competition_id") == "L1"]
    path = raw_dir / "dcaribou" / "players-L1.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=reader.fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda r: int(r["player_id"])))
    return [path]
