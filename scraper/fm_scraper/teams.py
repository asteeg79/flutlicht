"""Vereinsliste aus raw/manual/teams.json (vom Admin bestätigt, KONZEPT 5.3)."""

import json
from pathlib import Path


def load_teams(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"{path} fehlt, zuerst die Vereinszuordnung anlegen")
    return json.loads(path.read_text(encoding="utf-8"))
