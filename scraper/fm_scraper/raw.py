"""Schreibt Rohdaten unverändert mit der Hülle { fetchedAt, url, phase, data } (KONZEPT 10).

Pfade auf `.gz` (Kader) werden kompakt und gzip-komprimiert geschrieben, mit mtime 0,
damit derselbe Inhalt dieselben Bytes ergibt.
"""

import gzip
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
    if path.suffix == ".gz":
        text = json.dumps(envelope, ensure_ascii=False, separators=(",", ":"))
        path.write_bytes(gzip.compress(text.encode("utf-8"), mtime=0))
    else:
        path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_raw(path: Path) -> Any:
    raw = gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
    return json.loads(raw.decode("utf-8"))["data"]
