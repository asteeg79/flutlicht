import base64
import json
from datetime import datetime, timezone

import pytest

from fm_scraper.client import (
    Client,
    FetchError,
    PauseRequired,
    RawResponse,
    _fetched_response,
    _page_response,
    classify,
)
from tests.conftest import FakeTransport, ok


def test_wartet_zwischen_abrufen_aber_nicht_vor_dem_ersten(make_client):
    client, sleeps = make_client(FakeTransport(ok(b'{"a":1}'), ok(b'{"b":2}')))
    assert client.get_json("u1") == {"a": 1}
    assert sleeps == []
    assert client.get_json("u2") == {"b": 2}
    assert sleeps == [14.0]  # Mitte von 8–20 s


def test_wechselt_bei_403_auf_den_naechsten_abrufweg(make_client):
    first = FakeTransport(RawResponse(403, b""))
    fallback = FakeTransport(ok(b'{"x":1}'), ok(b'{"y":2}'))
    client, _ = make_client(first, fallback)
    assert client.get_json("u1") == {"x": 1}
    # Einmal gewechselt, bleibt der Job auf dem Rückfallweg.
    assert client.get_json("u2") == {"y": 2}
    assert first.urls == ["u1"]
    assert fallback.urls == ["u1", "u2"]
    assert first.closed


def test_merkt_sich_den_abrufweg_ueber_laeufe_hinweg(make_client, tmp_path):
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(ok()))
    client.get_json("u1")
    assert json.loads((tmp_path / "state.json").read_text())["route"] == "page"
    # Der nächste Lauf beginnt gleich auf dem Weg, der zuletzt ging.
    first, fallback = FakeTransport(), FakeTransport(ok())
    client, _ = make_client(first, fallback)
    client.get_json("u2")
    assert (first.urls, fallback.urls) == ([], ["u2"])


def test_nach_der_pause_beginnt_die_kette_wieder_vorn(make_client, tmp_path):
    (tmp_path / "state.json").write_text(json.dumps({"route": "page"}))
    client, _ = make_client(FakeTransport(), FakeTransport(RawResponse(403, b"")))
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    assert "route" not in json.loads((tmp_path / "state.json").read_text())


def test_ein_abrufweg_der_nicht_startet_wird_uebersprungen(tmp_path):
    from tests.conftest import DAYTIME

    def broken():
        raise RuntimeError("Xvfb fehlt")

    working = FakeTransport(ok(b'{"x":1}'))
    routes = [("direct", broken), ("page", lambda: working)]
    client = Client(routes, tmp_path / "state.json", now=lambda: DAYTIME)
    assert client.get_json("u1") == {"x": 1}
    # Startet auch der letzte Weg nicht, gilt das wie eine Sperre: Pause statt Absturz.
    client = Client([("window", broken)], tmp_path / "other.json", now=lambda: DAYTIME)
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    assert "Xvfb fehlt" in json.loads((tmp_path / "other.json").read_text())["pauseReason"]


def test_startet_keinen_browser_solange_abrufe_nicht_erlaubt_sind(tmp_path):
    from tests.conftest import DAYTIME

    (tmp_path / "state.json").write_text(json.dumps({"pauseUntil": "2026-09-24T19:00:00+00:00"}))
    started: list[str] = []
    client = Client([("direct", lambda: started.append("x"))], tmp_path / "state.json", now=lambda: DAYTIME)
    # Der Scheduler legt alle 5 Min. einen Client an, auch während der Pause.
    with pytest.raises(PauseRequired):
        client.get_json("u1")
    assert started == []


def test_wertet_html_statt_json_als_bot_challenge(make_client):
    fallback = FakeTransport(ok(b'{"x":1}'))
    client, _ = make_client(FakeTransport(ok(b"<html>challenge</html>")), fallback)
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


def test_bilder_wechseln_bei_403_auf_den_naechsten_abrufweg(make_client):
    first = FakeTransport(RawResponse(403, b'{"error": {"code": 403}}'))
    fallback = FakeTransport(ok(b"PNG1"), ok(b"PNG2"))
    client, _ = make_client(first, fallback)
    assert client.get_bytes("img1") == b"PNG1"
    assert client.get_bytes("img2") == b"PNG2"
    assert first.urls == ["img1"]
    assert fallback.urls == ["img1", "img2"]


def test_bilder_pausieren_wenn_auch_der_rueckfall_gesperrt_ist(make_client, tmp_path):
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


def test_chromium_fehlerseite_ist_keine_sperre(make_client, tmp_path):
    # 26.10.2026 auf dem Pi: Chromium meldete ERR_CERT_VERIFIER_CHANGED, der Abruf erreichte
    # Sofascore nie. Der Job scheitert und wird wiederholt, der Abrufweg bleibt „direct“.
    page = _page_response(
        {"status": 0, "error": True, "text": "This site can’t be reached\n\nERR_CERT_VERIFIER_CHANGED"}
    )
    fallback = FakeTransport(ok())
    client, _ = make_client(FakeTransport(page), fallback)
    with pytest.raises(FetchError) as e:
        client.get_json("u1")
    assert e.value.status is None
    assert str(e.value) == "u1 nicht erreichbar"
    assert fallback.urls == []
    assert not (tmp_path / "state.json").exists()


def test_browser_seite_wird_zu_status_und_inhalt():
    png = base64.b64encode(b"\x89PNG").decode()
    assert _page_response({"status": 200, "png": png}) == RawResponse(200, b"\x89PNG")
    assert _page_response({"status": 200, "text": "{}"}) == RawResponse(200, b"{}")
    # Ohne responseStatus (älteres Chromium) meldet der Browser keinen Status, classify entscheidet.
    assert _page_response({"status": 0, "text": "{}"}) == RawResponse(None, b"{}")
    assert _page_response({"status": 0, "error": True, "text": "x"}).reached is False


def test_classify_ist_die_eine_entscheidung_ueber_eine_antwort():
    png = b"\x89PNG...."
    assert classify(RawResponse(200, b"{}"), expect_json=True) == "ok"
    assert classify(RawResponse(200, b"<html>"), expect_json=True) == "blocked"
    assert classify(RawResponse(200, png), expect_json=False) == "ok"
    assert classify(RawResponse(403, b"{}"), expect_json=True) == "blocked"
    assert classify(RawResponse(429, b""), expect_json=True) == "rate-limited"
    assert classify(RawResponse(404, b"{}"), expect_json=False) == "error"
    assert classify(RawResponse(None, b"x", reached=False), expect_json=True) == "unreachable"
    # Ohne Status: gültiges JSON oder PNG, sonst Sperre (wie bisher die 403 des Browsers).
    assert classify(RawResponse(None, b"{}"), expect_json=True) == "ok"
    assert classify(RawResponse(None, b"<html>"), expect_json=True) == "blocked"
    assert classify(RawResponse(None, png), expect_json=False) == "ok"
    assert classify(RawResponse(None, png), expect_json=True) == "blocked"
    assert classify(RawResponse(None, b""), expect_json=False) == "blocked"


def test_fetch_aus_der_seite_wird_zu_status_und_inhalt():
    webp = base64.b64encode(b"RIFF....WEBP").decode()
    assert _fetched_response({"status": 200, "text": "{}"}) == RawResponse(200, b"{}")
    assert _fetched_response({"status": 200, "b64": webp}) == RawResponse(200, b"RIFF....WEBP")
    assert _fetched_response({"status": 403, "text": '{"error": {"code": 403}}'}).status == 403
