"""Einzige Stelle für HTTP (KONZEPT 10): Pacing, Abrufwege mit Rückfall, Pausen.

Scraping-Regeln (KONZEPT 5.6): keine Parallelität, 8–20 s Abstand, Abruf im Browser
(„direct“), bei 403/Bot-Challenge der nächste Abrufweg („page“, dann „window“), bei 429
oder wenn alle Wege gesperrt sind Abbruch und 6 h Pause, nachts keine Abrufe.
"""

from __future__ import annotations

import base64
import json
import logging
import random
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Literal, Protocol, Sequence
from zoneinfo import ZoneInfo

from . import config

log = logging.getLogger(__name__)


class PauseRequired(Exception):
    """Abrufe sind gerade nicht erlaubt (Pause nach 429/403 oder Nachtruhe)."""


class FetchError(Exception):
    """Abruf gescheitert, ohne Sperre: anderer HTTP-Status oder Ziel nicht erreicht (status None)."""

    def __init__(self, url: str, status: int | None):
        super().__init__(f"HTTP {status} für {url}" if status is not None else f"{url} nicht erreichbar")
        self.url = url
        self.status = status


@dataclass
class RawResponse:
    """Was ein Abrufweg gesehen hat. `status` None: Der Browser kennt keinen Status (älteres
    Chromium). `reached` False: Das Ziel wurde nie erreicht (Chromium-Fehlerseite)."""

    status: int | None
    body: bytes
    reached: bool = True


Outcome = Literal["ok", "rate-limited", "blocked", "unreachable", "error"]


def classify(response: RawResponse, expect_json: bool) -> Outcome:
    """Die eine Stelle, die entscheidet, was eine Antwort bedeutet.

    ok: gültiger Inhalt. rate-limited: 429, Pause. blocked: 403 oder Bot-Challenge (HTML
    statt JSON), nächster Abrufweg. unreachable: Ziel nie erreicht, Fehlschlag ohne Sperre.
    error: jeder andere Status (etwa 404), Fehlschlag ohne Sperre."""
    if not response.reached:
        return "unreachable"
    if response.status is None:
        # Älteres Chromium ohne Status: nur JSON oder ein Bild aus dem Canvas (PNG) zählt.
        seen = _looks_valid(response.body, True) or response.body.startswith(b"\x89PNG")
        return "ok" if seen and _looks_valid(response.body, expect_json) else "blocked"
    if response.status == 200:
        return "ok" if _looks_valid(response.body, expect_json) else "blocked"
    if response.status == 429:
        return "rate-limited"
    if response.status == 403:
        return "blocked"
    return "error"


class Transport(Protocol):
    def get(self, url: str) -> RawResponse: ...


# Ein Abrufweg: Name (steht im Zustand und im Lebenszeichen) und Start seines Transports.
Route = tuple[str, Callable[[], Transport]]


class Client:
    """Ruft über den ersten Abrufweg ab und wechselt bei einer Sperre auf den nächsten.

    Der Weg, der zuletzt ging, steht im Zustand (`route`): der nächste Lauf beginnt dort.
    Sind alle gesperrt, folgt die Pause, und danach beginnt die Kette wieder vorn.
    """

    def __init__(
        self,
        routes: Sequence[Route],
        state_file: Path,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        sleep: Callable[[float], None] = time.sleep,
        uniform: Callable[[float, float], float] = random.uniform,
        pacing: tuple[float, float] = config.PACING_SECONDS,
    ):
        self._routes = list(routes)
        self._index: int | None = None
        self._transport: Transport | None = None
        self._state_file = state_file
        self._now = now
        self._sleep = sleep
        self._uniform = uniform
        self._pacing = pacing
        self._requests_made = 0

    def get_json(self, url: str) -> Any:
        return json.loads(self._fetch(url, expect_json=True))

    def get_bytes(self, url: str) -> bytes:
        """Bilder: gleicher Ablauf wie JSON; „direct“ liefert das Bild als PNG, die anderen Wege im Original."""
        return self._fetch(url, expect_json=False)

    def _fetch(self, url: str, expect_json: bool) -> bytes:
        while True:
            response = self._send(url)
            outcome = classify(response, expect_json)
            if outcome == "ok":
                self._remember_route()
                return response.body
            if outcome == "rate-limited":
                self._start_pause("429 Too Many Requests")
            if outcome != "blocked":
                raise FetchError(url, response.status)
            log.warning("%s bei %s über „%s“: %r", response.status, url, self._route_name(), response.body[:200])
            self.close()
            self._index += 1
            if self._index == len(self._routes):
                self._start_pause(f"wiederholt 403/Bot-Challenge bei {url}", reset_route=True)
            log.warning("wechsle auf den Abrufweg „%s“", self._route_name())

    def close(self) -> None:
        close = getattr(self._transport, "close", None)
        if close:
            close()
        self._transport = None

    def _send(self, url: str) -> RawResponse:
        self._check_allowed()
        if self._requests_made > 0:
            self._sleep(self._uniform(*self._pacing))
        self._requests_made += 1
        transport = self._open()
        log.info("GET %s", url)
        return transport.get(url)

    def _open(self) -> Transport:
        """Transport des aktuellen Abrufwegs; startet einer nicht (etwa kein Display), gilt der nächste."""
        if self._index is None:
            names = [name for name, _ in self._routes]
            saved = self._read_state().get("route")
            self._index = names.index(saved) if saved in names else 0
        while self._transport is None:
            name, start = self._routes[self._index]
            try:
                self._transport = start()
            except Exception as e:  # der Browser-Start kann an vielem scheitern
                log.warning("Abrufweg „%s“ startet nicht: %s", name, e)
                self._index += 1
                if self._index == len(self._routes):
                    self._start_pause(f"Abrufweg „{name}“ startet nicht: {e}"[:300], reset_route=True)
        return self._transport

    def _route_name(self) -> str:
        return self._routes[self._index][0]

    def _remember_route(self) -> None:
        state = self._read_state()
        if state.get("route") != self._route_name():
            state["route"] = self._route_name()
            self._write_state(state)

    def _check_allowed(self) -> None:
        now = self._now()
        pause_until = self._read_state().get("pauseUntil")
        if pause_until and now < datetime.fromisoformat(pause_until):
            raise PauseRequired(f"Pause bis {pause_until}")
        start, end = config.NIGHT_HOURS
        if start <= now.astimezone(ZoneInfo(config.TIMEZONE)).hour < end:
            raise PauseRequired("Nachtruhe: zwischen 00 und 07 Uhr keine Abrufe")

    def _start_pause(self, reason: str, reset_route: bool = False) -> None:
        until = self._now() + timedelta(hours=config.PAUSE_HOURS)
        state = self._read_state()
        state["pauseUntil"] = until.isoformat()
        state["pauseReason"] = reason
        if reset_route:
            state.pop("route", None)
        self._write_state(state)
        log.warning("%s: Job abgebrochen, Pause bis %s", reason, until.isoformat())
        raise PauseRequired(reason)

    def _read_state(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return {}
        return json.loads(self._state_file.read_text())

    def _write_state(self, state: dict[str, Any]) -> None:
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(json.dumps(state, indent=2))


def _looks_valid(body: bytes, expect_json: bool) -> bool:
    """Eine Bot-Challenge kommt als HTML mit Status 200 statt als JSON."""
    if not expect_json:
        return not body.lstrip().startswith(b"<")
    try:
        json.loads(body)
    except ValueError:
        return False
    return True


# Status aus der Navigation (kein zweiter Abruf); ein Bild wird über ein Canvas zu PNG.
# Eine Chromium-Fehlerseite (Netz, Zertifikat) hat die Adresse chrome-error://chromewebdata/.
_READ_PAGE_JS = """
const nav = performance.getEntriesByType("navigation")[0];
const status = (nav && nav.responseStatus) || 0;
if (location.protocol === "chrome-error:")
  return { status, error: true, text: document.body ? document.body.innerText : "" };
const img = document.contentType.startsWith("image/") ? document.images[0] : null;
if (!img) return { status, text: document.body ? document.body.innerText : "" };
if (!img.complete || !img.naturalWidth) return { status, text: "" };
const canvas = document.createElement("canvas");
canvas.width = img.naturalWidth;
canvas.height = img.naturalHeight;
canvas.getContext("2d").drawImage(img, 0, 0);
return { status, png: canvas.toDataURL("image/png").split(",")[1] };
"""


class DirectTransport:
    """Abrufweg „direct“ (headless Chromium): ruft die API-URL direkt auf und liest Text oder Bild.

    Das Blockieren wirkt über Dateiendungen: Es verhindert den Favicon-Abruf (kein
    zusätzlicher Endpunkt, 5.6), die Bild-URL `.../image` hat keine Endung und lädt."""

    def __init__(self) -> None:
        from botasaurus_driver import Driver

        self._driver = Driver(headless=True, block_images_and_css=True)

    def get(self, url: str) -> RawResponse:
        self._driver.get(url)
        return _page_response(self._driver.run_js(_READ_PAGE_JS))

    def close(self) -> None:
        self._driver.close()


# fetch aus der geladenen Seite, wie es die Website selbst tut; Bilder kommen als Base64.
_FETCH_JS = """
return (async () => {
  const r = await fetch(args.url, { credentials: "include" });
  if (!(r.headers.get("content-type") || "").startsWith("image/"))
    return { status: r.status, text: await r.text() };
  const bytes = new Uint8Array(await r.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { status: r.status, b64: btoa(s) };
})();
"""


class PageTransport:
    """Abrufwege „page“ und „window“ (Rückfall): lädt einmal die Sofascore-Startseite und holt
    die Daten per fetch aus der Seite. Das feste Profil behält Cookies zwischen den Läufen.

    `window=True` startet Chromium mit Fenster statt headless, unter Linux in einem
    virtuellen Display (braucht Xvfb)."""

    def __init__(self, window: bool = False) -> None:
        from botasaurus_driver import Driver

        self._driver = Driver(
            headless=not window,
            enable_xvfb_virtual_display=window and sys.platform == "linux",
            profile=str(config.STATE_DIR / "browser-profile"),
            block_images_and_css=True,
        )
        try:
            self._driver.get(config.SITE)
        except Exception:
            self._driver.close()
            raise

    def get(self, url: str) -> RawResponse:
        return _fetched_response(self._driver.run_js(_FETCH_JS, {"url": url}))

    def close(self) -> None:
        self._driver.close()


def _fetched_response(result: dict[str, Any]) -> RawResponse:
    body = base64.b64decode(result["b64"]) if "b64" in result else result["text"].encode()
    return RawResponse(result["status"], body)


def _page_response(page: dict[str, Any]) -> RawResponse:
    if page.get("png"):
        body = base64.b64decode(page["png"])
    else:
        body = (page.get("text") or "").encode()
    # Ältere Chromium-Versionen kennen responseStatus nicht (0): dann entscheidet der Inhalt.
    status = page.get("status") or None
    # Chromium-Fehlerseite: Der Abruf erreichte Sofascore nie, keine Sperre.
    return RawResponse(status, body, reached=not page.get("error"))


class UrllibTransport:
    """Schlichtes HTTP ohne Browser: lokaler transfermarkt-api-Dienst und Downloads außerhalb von Sofascore."""

    def get(self, url: str) -> RawResponse:
        import urllib.error
        import urllib.request

        try:
            with urllib.request.urlopen(url, timeout=config.REQUEST_TIMEOUT_SECONDS * 4) as r:
                return RawResponse(r.status, r.read())
        except urllib.error.HTTPError as e:
            return RawResponse(e.code, e.read())


def tm_client() -> Client:
    """Client für den Transfermarkt-Crawl: 60–180 s Abstand, kein Rückfallweg, eigene Pause."""
    return Client(
        [("http", UrllibTransport)],
        config.STATE_DIR / "tm-state.json",
        pacing=config.TM_PACING_SECONDS,
    )


def download_client() -> Client:
    """Client für einzelne Downloads außerhalb von Sofascore (dcaribou-Datensatz auf R2):
    ohne Browser, eigene Pausendatei. Eine Sperre dort pausiert die Sofascore-Jobs nicht."""
    return Client([("http", UrllibTransport)], config.STATE_DIR / "download-state.json")


# Pausen-Zustand des Sofascore-Clients; der Scheduler meldet ihn mit dem Lebenszeichen.
STATE_FILE = config.STATE_DIR / "state.json"


def default_client() -> Client:
    return Client(
        [("direct", DirectTransport), ("page", PageTransport), ("window", lambda: PageTransport(window=True))],
        STATE_FILE,
    )
