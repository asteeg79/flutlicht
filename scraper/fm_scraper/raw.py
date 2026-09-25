"""Schreibt Rohdaten unverändert mit der Hülle { fetchedAt, url, phase, data } (KONZEPT 10)."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def write_raw(path: Path, url: str, phase: str, data: Any, fetched_at: datetime | None = None) -> None:
    fetched = (fetched_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    envelope = {
        "fetchedAt": fetched.isoformat().replace("+00:00", "Z"),
        "url": url,
        "phase": phase,
        "data": data,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_raw(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))["data"]
