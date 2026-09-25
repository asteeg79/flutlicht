from datetime import datetime, timezone
from pathlib import Path

import pytest

from fm_scraper.client import Client, RawResponse

# Donnerstag 15:00 Uhr Berlin (13:00 UTC): außerhalb der Nachtruhe.
DAYTIME = datetime(2026, 9, 24, 13, 0, tzinfo=timezone.utc)


class FakeTransport:
    """Liefert vorbereitete Antworten und merkt sich die abgerufenen URLs."""

    def __init__(self, *responses: RawResponse):
        self.responses = list(responses)
        self.urls: list[str] = []

    def get(self, url: str) -> RawResponse:
        self.urls.append(url)
        return self.responses.pop(0)


def ok(body: bytes = b"{}") -> RawResponse:
    return RawResponse(200, body)


@pytest.fixture
def make_client(tmp_path: Path):
    def make(request: FakeTransport, browser: FakeTransport | None = None, now=DAYTIME):
        sleeps: list[float] = []
        client = Client(
            request,
            lambda: browser or FakeTransport(),
            tmp_path / "state.json",
            now=lambda: now,
            sleep=sleeps.append,
            uniform=lambda a, b: (a + b) / 2,
        )
        return client, sleeps

    return make
