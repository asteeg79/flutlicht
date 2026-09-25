"""Einzige Stelle für HTTP (KONZEPT 10): Pacing, request→browser-Fallback, Pausen.

Scraping-Regeln (KONZEPT 5.6): keine Parallelität, 8–20 s Abstand, erst
botasaurus.request, nur bei 403/Bot-Challenge botasaurus.browser, bei 429 oder
wiederholtem 403 Abbruch und 6 h Pause, nachts keine Abrufe.
"""

from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Protocol
from zoneinfo import ZoneInfo

from . import config

log = logging.getLogger(__name__)


class PauseRequired(Exception):
    """Abrufe sind gerade nicht erlaubt (Pause nach 429/403 oder Nachtruhe)."""


class FetchError(Exception):
    def __init__(self, url: str, status: int):
        super().__init__(f"HTTP {status} für {url}")
        self.url = url
        self.status = status


@dataclass
class RawResponse:
    status: int
    body: bytes


class Transport(Protocol):
    def get(self, url: str) -> RawResponse: ...


class Client:
    def __init__(
        self,
        request_transport: Transport,
        browser_factory: Callable[[], Transport],
        state_file: Path,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        sleep: Callable[[float], None] = time.sleep,
        uniform: Callable[[float, float], float] = random.uniform,
    ):
        self._request = request_transport
        self._browser_factory = browser_factory
        self._browser: Transport | None = None
        self._state_file = state_file
        self._now = now
        self._sleep = sleep
        self._uniform = uniform
        self._requests_made = 0

    def get_json(self, url: str) -> Any:
        body = self._fetch(url, expect_json=True)
        return json.loads(body)

    def get_bytes(self, url: str) -> bytes:
        return self._fetch(url, expect_json=False)

    def _fetch(self, url: str, expect_json: bool) -> bytes:
        in_browser = self._browser is not None
        response = self._send(self._browser or self._request, url)
        if not in_browser and _is_blocked(response, expect_json):
            log.warning("403/Bot-Challenge bei %s, wechsle auf den Browser-Modus", url)
            self._browser = self._browser_factory()
            response = self._send(self._browser, url)
        if response.status == 200 and _looks_valid(response.body, expect_json):
            return response.body
        if response.status == 429:
            self._start_pause("429 Too Many Requests")
        if _is_blocked(response, expect_json):
            self._start_pause(f"wiederholt 403/Bot-Challenge bei {url}")
        raise FetchError(url, response.status)

    def close(self) -> None:
        close = getattr(self._browser, "close", None)
        if close:
            close()

    def _send(self, transport: Transport, url: str) -> RawResponse:
        self._check_allowed()
        if self._requests_made > 0:
            self._sleep(self._uniform(*config.PACING_SECONDS))
        self._requests_made += 1
        log.info("GET %s", url)
        return transport.get(url)

    def _check_allowed(self) -> None:
        now = self._now()
        pause_until = self._read_state().get("pauseUntil")
        if pause_until and now < datetime.fromisoformat(pause_until):
            raise PauseRequired(f"Pause bis {pause_until}")
        start, end = config.NIGHT_HOURS
        if start <= now.astimezone(ZoneInfo(config.TIMEZONE)).hour < end:
            raise PauseRequired("Nachtruhe: zwischen 00 und 07 Uhr keine Abrufe")

    def _start_pause(self, reason: str) -> None:
        until = self._now() + timedelta(hours=config.PAUSE_HOURS)
        state = self._read_state()
        state["pauseUntil"] = until.isoformat()
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(json.dumps(state, indent=2))
        log.warning("%s: Job abgebrochen, Pause bis %s", reason, until.isoformat())
        raise PauseRequired(reason)

    def _read_state(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return {}
        return json.loads(self._state_file.read_text())


def _is_blocked(response: RawResponse, expect_json: bool) -> bool:
    return response.status == 403 or (
        response.status == 200 and not _looks_valid(response.body, expect_json)
    )


def _looks_valid(body: bytes, expect_json: bool) -> bool:
    """Eine Bot-Challenge kommt als HTML mit Status 200 statt als JSON."""
    if not expect_json:
        return not body.lstrip().startswith(b"<")
    try:
        json.loads(body)
    except ValueError:
        return False
    return True


class BotasaurusRequestTransport:
    """Leichtgewichtiger Modus: HTTP mit Browser-Fingerprint, ohne Chromium."""

    def __init__(self) -> None:
        from botasaurus.request import create_request

        self._session = create_request()

    def get(self, url: str) -> RawResponse:
        r = self._session.get(
            url,
            referer="https://www.sofascore.com/",
            timeout=config.REQUEST_TIMEOUT_SECONDS,
        )
        return RawResponse(r.status_code, r.content)


class BotasaurusBrowserTransport:
    """Browser-Modus (headless Chromium): ruft die API-URL direkt auf und liest den Text."""

    def __init__(self) -> None:
        from botasaurus_driver import Driver

        self._driver = Driver(headless=True, block_images_and_css=True)

    def get(self, url: str) -> RawResponse:
        self._driver.get(url)
        text = self._driver.run_js("return document.body ? document.body.innerText : ''")
        body = (text or "").encode()
        # Den HTTP-Status liefert die Seite nicht; ungültiges JSON zählt als Sperre.
        return RawResponse(200 if _looks_valid(body, True) else 403, body)

    def close(self) -> None:
        self._driver.close()


def default_client() -> Client:
    return Client(
        BotasaurusRequestTransport(),
        BotasaurusBrowserTransport,
        config.STATE_DIR / "state.json",
    )
