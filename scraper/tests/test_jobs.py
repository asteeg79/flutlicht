import json

import pytest

from fm_scraper.jobs import match_final, round_events
from fm_scraper.raw import read_raw
from tests.conftest import FakeTransport, ok


def event(id_: int, status: str) -> dict:
    return {"id": id_, "status": {"type": status}}


def test_round_events_schreibt_die_hülle(make_client, tmp_path):
    data = {"events": [event(1, "finished")]}
    client, _ = make_client(FakeTransport(ok(json.dumps(data).encode())))
    [path] = round_events.run(client, tmp_path, 5)
    assert path == tmp_path / "sofascore/rounds/round-05.json"
    envelope = json.loads(path.read_text())
    assert envelope["url"].endswith("/unique-tournament/35/season/97464/events/round/5")
    assert envelope["phase"] == "round"
    assert envelope["fetchedAt"].endswith("Z")
    assert envelope["data"] == data


def write_round(tmp_path, events):
    path = round_events.round_path(tmp_path, 5)
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"data": {"events": events}}))


def test_match_final_holt_nur_beendete_spiele(make_client, tmp_path):
    write_round(tmp_path, [event(1, "finished"), event(2, "notstarted")])
    request = FakeTransport(ok(b'{"home":{}}'), ok(b'{"incidents":[]}'))
    client, _ = make_client(request)
    written = match_final.run(client, tmp_path, 5)
    assert [p.relative_to(tmp_path).as_posix() for p in written] == [
        "sofascore/matches/1/final/lineups.json",
        "sofascore/matches/1/final/incidents.json",
    ]
    assert request.urls[0].endswith("/event/1/lineups")
    assert read_raw(written[1]) == {"incidents": []}


def test_match_final_mit_event_holt_nur_dieses_spiel(make_client, tmp_path):
    write_round(tmp_path, [event(1, "finished"), event(3, "finished")])
    request = FakeTransport(ok(), ok())
    client, _ = make_client(request)
    match_final.run(client, tmp_path, 5, event_id=3)
    assert all("/event/3/" in u for u in request.urls)


def test_match_final_ohne_round_datei_bricht_ab(make_client, tmp_path):
    client, _ = make_client(FakeTransport())
    with pytest.raises(SystemExit):
        match_final.run(client, tmp_path, 5)


def test_match_final_ueberspringt_vorhandene_spiele(make_client, tmp_path):
    write_round(tmp_path, [event(1, "finished"), event(3, "finished")])
    done = tmp_path / "sofascore/matches/1/final"
    done.mkdir(parents=True)
    (done / "incidents.json").write_text("{}")
    request = FakeTransport(ok(), ok())
    client, _ = make_client(request)
    match_final.run(client, tmp_path, 5)
    assert all("/event/3/" in u for u in request.urls)


def test_match_final_mit_rundendatei_von_vor_dem_spieltag(make_client, tmp_path):
    """Spieltag 5, 12.10.2026: Die Rundendatei nennt alle Spiele notstarted, fixtures.json kennt den Stand."""
    raw = tmp_path / "raw"
    write_round(raw, [event(1, "notstarted"), event(2, "notstarted")])
    fixtures = [
        {"matchday": 5, "sofascoreEventId": 1, "status": "finished"},
        {"matchday": 5, "sofascoreEventId": 2, "status": "postponed"},
        {"matchday": 6, "sofascoreEventId": 3, "status": "finished"},
    ]
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "fixtures.json").write_text(json.dumps(fixtures))
    request = FakeTransport(ok(), ok())
    client, _ = make_client(request)
    written = match_final.run(client, raw, 5)
    assert len(written) == 2
    assert all("/event/1/" in u for u in request.urls)


def test_match_final_ohne_beendetes_spiel_ist_ein_fehler(make_client, tmp_path):
    write_round(tmp_path, [event(1, "notstarted")])
    client, _ = make_client(FakeTransport())
    with pytest.raises(SystemExit):
        match_final.run(client, tmp_path, 5)
