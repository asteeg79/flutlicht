import json
import urllib.error
import urllib.request

import pytest

from fm_scraper import config, heartbeat


class Recorder:
    """Ersetzt urlopen: merkt sich die Anfragen, es geht nichts ins Netz."""

    def __init__(self, error: Exception | None = None):
        self.requests: list[urllib.request.Request] = []
        self.error = error

    def __call__(self, request, timeout):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self

    def close(self):
        pass


@pytest.fixture
def secret_file(tmp_path, monkeypatch):
    path = tmp_path / "heartbeat-secret"
    monkeypatch.setattr(heartbeat, "SECRET_FILE", path)
    return path


def test_ohne_secret_datei_keine_meldung(secret_file, monkeypatch):
    urlopen = Recorder()
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    heartbeat.send({})
    assert urlopen.requests == []


def test_meldet_sich_per_post_mit_bearer_und_schickt_den_stand_mit(secret_file, monkeypatch):
    secret_file.write_text("pi-geheim\n")
    urlopen = Recorder()
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    heartbeat.send({"pause": None, "unpushed": 0})
    (request,) = urlopen.requests
    assert request.full_url == config.HEARTBEAT_URL
    assert request.get_method() == "POST"
    assert request.get_header("Authorization") == "Bearer pi-geheim"
    assert request.get_header("Content-type") == "application/json"
    assert json.loads(request.data) == {"pause": None, "unpushed": 0}


def test_fehler_brechen_den_scheduler_nicht_ab(secret_file, monkeypatch, caplog):
    secret_file.write_text("pi-geheim")
    for error in (urllib.error.URLError("kein Netz"), TimeoutError("zu langsam")):
        monkeypatch.setattr(urllib.request, "urlopen", Recorder(error))
        heartbeat.send({})
    assert caplog.text.count("Lebenszeichen fehlgeschlagen") == 2
