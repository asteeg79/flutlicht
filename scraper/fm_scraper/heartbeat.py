"""Lebenszeichen an die App (docs/betrieb.md): `/admin` zeigt es, der Tick warnt bei Stille.

Kein Sofascore-Abruf, deshalb ohne Pacing und Nachtruhe und nicht über `client.py`.
"""

import logging
import urllib.request

from . import config

log = logging.getLogger(__name__)
SECRET_FILE = config.STATE_DIR / "heartbeat-secret"


def send() -> None:
    """Meldet der App, dass der Scheduler läuft. Ohne Secret-Datei keine Meldung; Fehler nur ins Log."""
    if not SECRET_FILE.exists():
        return
    request = urllib.request.Request(
        config.HEARTBEAT_URL,
        data=b"",
        method="POST",
        headers={
            "Authorization": f"Bearer {SECRET_FILE.read_text().strip()}",
            "User-Agent": "flutlicht-scraper",
        },
    )
    try:
        urllib.request.urlopen(request, timeout=config.HEARTBEAT_TIMEOUT_SECONDS).close()
    except OSError as e:  # URLError, HTTPError und Zeitüberschreitung
        log.warning("Lebenszeichen fehlgeschlagen: %s", e)
