import base64
import json
from datetime import datetime, timezone

import pytest

from fm_scraper.client import FetchError, PauseRequired, RawResponse, _page_response
from tests.conftest import FakeTransport, ok


def test_wartet_zwischen_abrufen_aber_nicht_vor_dem_ersten(make_client):
    client, sleeps = make_client(FakeTransport(ok(b'{"a":1}'), ok(b'{"b":2}')))
    assert client.get_json("u1") == {"a": 1}
    assert sleeps == []
    assert client.get_json("u2") == {"b": 2}
    assert sleeps == [14.0]  # Mitte von 8–20 s


def test_wechselt_bei_403_auf_den_browser(make_client):
    request = FakeTransport(RawResponse(403, b""))
    browser = FakeTransport(ok(b'{"x":1}'), ok(b'{"y":2}'))
    client, _ = make_client(request, browser)
    assert client.get_json("u1") == {"x": 1}
    # Einmal gewechselt, bleibt der Job im Browser-Modus.
    assert client.get_json("u2") == {"y": 2}
    assert request.urls == ["u1"]
    assert browser.urls == ["u1", "u2"]


def test_wertet_html_statt_json_als_bot_challenge(make_client):
    browser = FakeTransport(ok(b'{"x":1}'))
    client, _ = make_client(FakeTransport(ok(b"<html>challenge</html>")), browser)
    assert client.get_json("u1") == {"x": 1}


def test_pausiert_6_stunden_bei_wiederholtem_403(make_client, tmp_path):
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(RawResponse(403, b"")))
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    state = json.loads((tmp_path / "state.json").read_text())
    assert state["pauseUntil"] == "2026-09-24T19:00:00+00:00"
    assert state["pauseReason"] == "wiederholt 403/Bot-Challenge bei u1"


def test_pausiert_bei_429_ohne_retry(make_client, tmp_path):
    request = FakeTransport(RawResponse(429, b""))
    client, _ = make_client(request)
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    assert request.urls == ["u1"]
    assert (tmp_path / "state.json").exists()


def test_ruft_waehrend_einer_pause_nichts_ab(make_client, tmp_path):
    (tmp_path / "state.json").write_text(json.dumps({"pauseUntil": "2026-09-24T19:00:00+00:00"}))
    request = FakeTransport(ok())
    client, _ = make_client(request)
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    assert request.urls == []


def test_ruft_nach_ablauf_der_pause_wieder_ab(make_client, tmp_path):
    (tmp_path / "state.json").write_text(json.dumps({"pauseUntil": "2026-09-24T12:00:00+00:00"}))
    client, _ = make_client(FakeTransport(ok(b"[]")))
    assert client.get_json("u1") == []


@pytest.mark.parametrize(
    "utc_hour, allowed",
    [(21, True), (22, False), (4, False), (5, True)],  # Berlin = UTC+2 im September
)
def test_nachtruhe_von_0_bis_7_uhr_berlin(make_client, utc_hour, allowed):
    now = datetime(2026, 9, 24, utc_hour, 0, tzinfo=timezone.utc)
    request = FakeTransport(ok())
    client, _ = make_client(request, now=now)
    if allowed:
        client.get_json("u1")
    else:
        with pytest.raises(PauseRequired):
            client.get_json("u1")
        assert request.urls == []


def test_meldet_andere_fehler_ohne_pause(make_client, tmp_path):
    client, _ = make_client(FakeTransport(RawResponse(404, b"")))
    with pytest.raises(FetchError) as e:
        client.get_json("u1")
    assert e.value.status == 404
    assert not (tmp_path / "state.json").exists()


def test_laedt_bilder_als_bytes(make_client):
    client, _ = make_client(FakeTransport(ok(b"RIFF....WEBP")))
    assert client.get_bytes("img") == b"RIFF....WEBP"


def test_bilder_wechseln_bei_403_auf_den_browser(make_client):
    request = FakeTransport(RawResponse(403, b'{"error": {"code": 403}}'))
    browser = FakeTransport(ok(b"PNG1"), ok(b"PNG2"))
    client, _ = make_client(request, browser)
    assert client.get_bytes("img1") == b"PNG1"
    assert client.get_bytes("img2") == b"PNG2"
    assert request.urls == ["img1"]
    assert browser.urls == ["img1", "img2"]


def test_bilder_pausieren_wenn_auch_der_browser_gesperrt_ist(make_client, tmp_path):
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(RawResponse(403, b"")))
    with pytest.raises(PauseRequired):
        client.get_bytes("img1")
    assert (tmp_path / "state.json").exists()


def test_browser_json_fehler_mit_status_403_ist_eine_sperre(make_client, tmp_path):
    # Die Sperre kommt als gültiges JSON; entscheidend ist der Status der Navigation.
    blocked = _page_response({"status": 403, "text": '{"error": {"code": 403, "reason": "Forbidden"}}'})
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(blocked))
    with pytest.raises(PauseRequired):
        client.get_json("u1")


def test_browser_404_ist_keine_sperre(make_client, tmp_path):
    missing = _page_response({"status": 404, "text": '{"error": {"code": 404}}'})
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(missing))
    with pytest.raises(FetchError) as e:
        client.get_json("u1")
    assert e.value.status == 404
    assert not (tmp_path / "state.json").exists()


def test_browser_seite_wird_zu_status_und_inhalt():
    png = base64.b64encode(b"\x89PNG").decode()
    assert _page_response({"status": 200, "png": png}) == RawResponse(200, b"\x89PNG")
    assert _page_response({"status": 200, "text": "{}"}) == RawResponse(200, b"{}")
    # Ohne responseStatus (älteres Chromium): nur gültiger Inhalt zählt als 200.
    assert _page_response({"status": 0, "text": "{}"}).status == 200
    assert _page_response({"status": 0, "text": "<html>"}).status == 403
    assert _page_response({"status": 0, "png": png}).status == 200
