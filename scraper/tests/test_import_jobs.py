import csv
import gzip
import io
import json
from datetime import date, datetime, timezone

import pytest
from PIL import Image

from fm_scraper import config
from fm_scraper.client import PauseRequired, RawResponse
from fm_scraper.raw import read_raw, write_raw
from fm_scraper.jobs import backfill, dcaribou, images, round_events, squads, tm_crawl
from tests.conftest import FakeTransport, ok

TEAMS = [{"id": 2672}, {"id": 2547}]


def test_squads_legt_nach_datum_ab_und_ueberspringt_vorhandene(make_client, tmp_path):
    day = tmp_path / "sofascore/squads/2026-09-25"
    day.mkdir(parents=True)
    (day / "2672.json.gz").write_bytes(b"")
    request = FakeTransport(ok(b'{"players": []}'))
    client, _ = make_client(request)
    written = squads.run(client, tmp_path, TEAMS, date(2026, 9, 25))
    assert written == [day / "2547.json.gz"]
    assert request.urls == [f"{config.API}/team/2547/players"]
    assert read_raw(day / "2547.json.gz") == {"players": []}


def test_ids_aus_daten_muessen_zahlen_sein(make_client, tmp_path):
    """Eine ID aus Rohdaten landet in der URL: keine Zahl, kein Abruf."""
    request = FakeTransport(ok(b'{"players": []}'))
    client, _ = make_client(request)
    with pytest.raises(ValueError):
        squads.run(client, tmp_path, [{"id": "2547/../x"}], date(2026, 9, 25))
    assert request.urls == []


def test_write_raw_gz_schreibt_kompakt_und_ohne_zeitstempel(tmp_path):
    path = tmp_path / "x.json.gz"
    write_raw(path, "u", "squad", {"players": []}, datetime(2026, 10, 21, tzinfo=timezone.utc))
    data = path.read_bytes()
    assert data[4:8] == b"\0\0\0\0"  # gzip-mtime 0: gleicher Inhalt ergibt gleiche Bytes
    assert gzip.decompress(data) == b'{"fetchedAt":"2026-10-21T00:00:00Z","url":"u","phase":"squad","data":{"players":[]}}'


def test_backfill_holt_round_nur_wenn_sie_fehlt(make_client, tmp_path):
    rounds = {"events": [{"id": 7, "status": {"type": "finished"}}]}
    request = FakeTransport(ok(json.dumps(rounds).encode()), ok(), ok())
    client, _ = make_client(request)
    backfill.run(client, tmp_path, 2)
    assert request.urls[0].endswith("/events/round/2")
    assert [u.rsplit("/", 1)[1] for u in request.urls[1:]] == ["lineups", "incidents"]
    # Zweiter Lauf: alles vorhanden, kein Abruf.
    again = FakeTransport()
    client2, _ = make_client(again)
    assert backfill.run(client2, tmp_path, 2) == []
    assert again.urls == []
    assert round_events.round_path(tmp_path, 2).exists()


def gz_csv(rows: list[dict]) -> bytes:
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
    return gzip.compress(out.getvalue().encode())


def test_dcaribou_filtert_auf_die_bundesliga(make_client, tmp_path):
    rows = [
        {"player_id": "20", "name": "B", "current_club_domestic_competition_id": "L1"},
        {"player_id": "3", "name": "C", "current_club_domestic_competition_id": "GB1"},
        {"player_id": "10", "name": "A", "current_club_domestic_competition_id": "L1"},
    ]
    client, _ = make_client(FakeTransport(ok(gz_csv(rows))))
    [path] = dcaribou.run(client, tmp_path)
    result = list(csv.DictReader(path.open()))
    assert [r["player_id"] for r in result] == ["10", "20"]


def test_tm_crawl_holt_vereinsliste_und_je_verein_die_spieler(make_client, tmp_path):
    clubs = {"clubs": [{"id": "27", "name": "Bayern"}, {"id": "89", "name": "Union"}]}
    request = FakeTransport(ok(json.dumps(clubs).encode()), ok(b'{"players":[]}'), ok(b'{"players":[]}'))
    client, _ = make_client(request)
    written = tm_crawl.run(client, tmp_path, date(2026, 9, 26))
    assert [p.name for p in written] == ["clubs.json", "club-27.json", "club-89.json"]
    assert request.urls[1] == f"{config.TM_API}/clubs/27/players"


def test_tm_crawl_ohne_rueckfall_bricht_bei_403_mit_pause_ab(tmp_path):
    from fm_scraper.client import Client
    from tests.conftest import DAYTIME

    blocked = FakeTransport(RawResponse(403, b""))
    client = Client([("http", lambda: blocked)], tmp_path / "tm.json", now=lambda: DAYTIME)
    with pytest.raises(PauseRequired):
        tm_crawl.run(client, tmp_path, date(2026, 9, 26))


def png(size: int) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (size, size), "green").save(out, "PNG")
    return out.getvalue()


def write_squad(tmp_path, player_ids):
    path = tmp_path / "raw/sofascore/squads/2026-09-25/2672.json.gz"
    path.parent.mkdir(parents=True)
    path.write_bytes(gzip.compress(json.dumps({"data": {"players": [{"player": {"id": i}} for i in player_ids]}}).encode()))


def test_images_erst_logos_dann_spieler_als_128px_webp(make_client, tmp_path, monkeypatch):
    write_squad(tmp_path, [5, 4])
    img_dir = tmp_path / "img"
    (img_dir / "players").mkdir(parents=True)
    (img_dir / "players" / "4.webp").write_bytes(b"x")
    monkeypatch.setattr(config, "IMAGES_PER_RUN", 3)
    request = FakeTransport(ok(png(256)), RawResponse(404, b""), ok(png(64)))
    client, _ = make_client(request)
    written = images.run(client, tmp_path / "raw", img_dir, TEAMS)
    assert [u.split("/v1/")[1] for u in request.urls] == [
        "team/2672/image",
        "team/2547/image",
        "player/5/image",
    ]
    assert [p.relative_to(img_dir).as_posix() for p in written] == ["clubs/2672.webp", "players/5.webp"]
    with Image.open(img_dir / "clubs/2672.webp") as im:
        assert im.format == "WEBP" and im.size == (128, 128)


def test_images_stoppt_nach_dem_limit(make_client, tmp_path, monkeypatch):
    write_squad(tmp_path, [1, 2, 3])
    monkeypatch.setattr(config, "IMAGES_PER_RUN", 1)
    request = FakeTransport(ok(png(10)))
    client, _ = make_client(request)
    assert len(images.run(client, tmp_path / "raw", tmp_path / "img", [])) == 1
    assert len(request.urls) == 1


def test_images_laedt_bei_403_ueber_den_rueckfall(make_client, tmp_path):
    write_squad(tmp_path, [1, 2])
    fallback = FakeTransport(ok(png(64)), ok(png(64)))
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), fallback)
    written = images.run(client, tmp_path / "raw", tmp_path / "img", [])
    assert [p.name for p in written] == ["1.webp", "2.webp"]


def test_images_fragt_spieler_ohne_foto_nur_einmal_ab(make_client, tmp_path):
    write_squad(tmp_path, [1, 2])
    request = FakeTransport(RawResponse(404, b""), ok(png(64)))
    client, _ = make_client(request)
    written = images.run(client, tmp_path / "raw", tmp_path / "img", [])
    assert [p.name for p in written] == ["2.webp"]
    missing = tmp_path / "raw" / "sofascore" / "images-missing.json"
    assert json.loads(missing.read_text()) == ["players/1"]
    assert images.todo(tmp_path / "raw", tmp_path / "img", []) == []


def test_images_merkt_sich_ein_403_nicht_als_kein_foto(make_client, tmp_path):
    # 403 heißt „Script gesperrt“ (das Bild gibt es im Browser): Es bleibt offen.
    write_squad(tmp_path, [1, 2, 3])
    client, _ = make_client(FakeTransport(RawResponse(403, b"")), FakeTransport(RawResponse(403, b"")))
    with pytest.raises(PauseRequired):
        images.run(client, tmp_path / "raw", tmp_path / "img", [])
    assert not (tmp_path / "raw" / "sofascore" / "images-missing.json").exists()
    assert images.todo(tmp_path / "raw", tmp_path / "img", []) == [("players", i) for i in (1, 2, 3)]
