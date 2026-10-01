"""Lebenszeichen an die App (docs/betrieb.md): `/admin` zeigt es, der Tick warnt bei Stille.

Kein Sofascore-Abruf, deshalb ohne Pacing und Nachtruhe und nicht über `client.py`.
"""

import json
import logging
import urllib.request
from typing import Any

from . import config

log = logging.getLogger(__name__)
SECRET_FILE = config.STATE_DIR / "heartbeat-secret"


def send(status: dict[str, Any]) -> None:
    """Meldet der App, dass der Scheduler läuft, und schickt seinen Stand mit (scheduler.status).
    Ohne Secret-Datei keine Meldung; Fehler nur ins Log."""
    if not SECRET_FILE.exists():
        return
    request = urllib.request.Request(
        config.HEARTBEAT_URL,
        data=json.dumps(status).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {SECRET_FILE.read_text().strip()}",
            "Content-Type": "application/json",
            "User-Agent": "flutlicht-scraper",
        },
    )
    try:
        urllib.request.urlopen(request, timeout=config.HEARTBEAT_TIMEOUT_SECONDS).close()
    except OSError as e:  # URLError, HTTPError und Zeitüberschreitung
        log.warning("Lebenszeichen fehlgeschlagen: %s", e)
