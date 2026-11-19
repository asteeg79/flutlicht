"""Scheduler-Entscheidungen mit fester Uhr (KONZEPT 10: Zeitfenster, Retries, Nachtpause)."""

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from fm_scraper import client, config, gitsync, heartbeat, scheduler
from fm_scraper.scheduler import Task, plan, record, status

BERLIN = ZoneInfo("Europe/Berlin")
# Wie data/season.json (postponedGraceDays).
GRACE = timedelta(days=3)


class Earliest:
    """„Zufall“, der immer den frühesten Zeitpunkt des Fensters liefert."""

    def uniform(self, a, b):
        return a


def at(s: str) -> datetime:
    """Berliner Ortszeit „2026-10-06 12:00“ → aware datetime."""
    return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=BERLIN)


def fixture(md, event, kickoff_berlin, status="scheduled", data_state="none", original=None):
    k = at(kickoff_berlin).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    o = at(original).astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if original else k
    return {
        "matchday": md,
        "sofascoreEventId": event,
        "kickoffUtc": k,
        "originalKickoffUtc": o,
        "status": status,
        "dataState": data_state,
    }


def keys(tasks):
    return [t.key for t in tasks]


def run_plan(now, fixtures, tmp_path, state=None, images_missing=False):
    state = state if state is not None else {}
    # squads der letzten Tage als erledigt markieren, damit es die übrigen Fälle nicht stört
    today = now.astimezone(BERLIN).date()
    for i in range(7):
        state.setdefault("done", {})[f"squads:{(today - timedelta(days=i)).isoformat()}"] = "x"
    return plan(now, fixtures, state, tmp_path, lambda: images_missing, Earliest(), grace=GRACE), state


def write_round(tmp_path, md):
    p = tmp_path / "sofascore" / "rounds" / f"round-{md:02d}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{}")


def write_final(tmp_path, event):
    p = tmp_path / "sofascore" / "matches" / str(event) / "final" / "incidents.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{}")


# Spieltag 5: Fr 09.10. 20:30 und Sa 10.10. 15:30 (Berlin).
MD5 = [fixture(5, 501, "2026-10-09 20:30"), fixture(5, 502, "2026-10-10 15:30")]


def test_nachts_laeuft_nichts(tmp_path):
    tasks, _ = run_plan(at("2026-10-10 02:00"), MD5, tmp_path)
    assert tasks == []


def test_round_events_am_dienstag_ab_10_uhr(tmp_path):
    assert keys(run_plan(at("2026-10-06 09:59"), MD5, tmp_path)[0]) == []
    assert keys(run_plan(at("2026-10-06 10:00"), MD5, tmp_path)[0]) == ["round:5"]
    write_round(tmp_path, 5)
    assert keys(run_plan(at("2026-10-06 12:00"), MD5, tmp_path)[0]) == []


def test_round_events_holt_verpasste_dienstage_nach(tmp_path):
    # Scheduler erst am Donnerstag gestartet: gleich heute, noch vor dem Anpfiff.
    assert keys(run_plan(at("2026-10-08 11:00"), MD5, tmp_path)[0]) == ["round:5"]


def test_provisorisch_135_minuten_nach_anpfiff(tmp_path):
    write_round(tmp_path, 5)
    assert "prov:501" not in keys(run_plan(at("2026-10-09 22:44"), MD5, tmp_path)[0])
    tasks, _ = run_plan(at("2026-10-09 22:45"), MD5, tmp_path)
    assert tasks == [Task("prov:501", "match-provisional", matchday=5, event=501)]


def test_provisorisch_nicht_nachts_sondern_am_morgen(tmp_path):
    late = [fixture(5, 509, "2026-10-09 22:00")]
    write_round(tmp_path, 5)
    tasks, state = run_plan(at("2026-10-10 07:00"), late, tmp_path)
    assert tasks == []
    planned = datetime.fromisoformat(state["planned"]["prov:509"]).astimezone(BERLIN)
    assert (planned.hour, planned.minute) == (7, 5)


def test_provisorisch_drei_versuche_im_abstand_von_15_minuten(tmp_path):
    write_round(tmp_path, 5)
    now = at("2026-10-09 22:45")
    tasks, state = run_plan(now, MD5, tmp_path)
    task = tasks[0]
    record(state, task, now, "unfinished")
    assert state["attempts"]["prov:501"] == 1
    assert "prov:501" not in keys(plan(now + timedelta(minutes=14), MD5, state, tmp_path, lambda: False, Earliest(), grace=GRACE))
    assert "prov:501" in keys(plan(now + timedelta(minutes=15), MD5, state, tmp_path, lambda: False, Earliest(), grace=GRACE))
    record(state, task, now + timedelta(minutes=15), "unfinished")
    record(state, task, now + timedelta(minutes=30), "unfinished")
    assert "prov:501" in state["done"]


def test_final_am_folgetag_zwischen_8_und_10(tmp_path):
    finished = [dict(f, status="finished", dataState="provisional") for f in MD5]
    write_round(tmp_path, 5)
    assert "final:5" not in keys(run_plan(at("2026-10-11 07:59"), finished, tmp_path)[0])
    assert "final:5" in keys(run_plan(at("2026-10-11 08:00"), finished, tmp_path)[0])
    for f in finished:
        write_final(tmp_path, f["sofascoreEventId"])
    assert "final:5" not in keys(run_plan(at("2026-10-11 09:00"), finished, tmp_path)[0])


def test_final_ohne_dateien_gilt_nicht_als_erledigt(tmp_path):
    """Zustand des Pi am 12.10.2026: final:5 als „ok“ vermerkt, aber nichts abgerufen."""
    finished = [dict(f, status="finished", dataState="provisional") for f in MD5]
    write_round(tmp_path, 5)
    now = at("2026-10-12 12:30")
    state = {"done": {"final:5": at("2026-10-12 09:41").isoformat()}, "planned": {"final:5": at("2026-10-12 09:41").isoformat()}}
    assert "final:5" in keys(run_plan(now, finished, tmp_path, state)[0])
    # Aufgegebene Spieltage bleiben erledigt, ebenso solche mit Daten.
    gave_up = dict(state, gaveUp={"final:5": at("2026-10-12 09:41").isoformat()})
    assert "final:5" not in keys(run_plan(now, finished, tmp_path, gave_up)[0])
    write_final(tmp_path, 501)
    assert "final:5" not in keys(run_plan(now, finished, tmp_path, state)[0])


def test_backfill_ein_spieltag_pro_tag(tmp_path):
    old = [fixture(3, 301, "2026-09-12 15:30", "finished", "pending"), fixture(4, 401, "2026-09-19 15:30", "finished", "pending")]
    now = at("2026-09-26 11:00")
    tasks, state = run_plan(now, old, tmp_path)
    assert tasks == [Task("final:3", "backfill", matchday=3)]
    record(state, tasks[0], now, "ok")
    write_final(tmp_path, 301)
    assert keys(plan(now + timedelta(hours=1), old, state, tmp_path, lambda: False, Earliest(), grace=GRACE)) == []
    assert "final:4" in keys(plan(at("2026-09-27 08:00"), old, state, tmp_path, lambda: False, Earliest(), grace=GRACE))


def test_verlegte_spiele_halten_die_finalisierung_nicht_auf(tmp_path):
    games = [
        dict(MD5[0], status="finished"),
        fixture(5, 503, "2026-11-20 20:30", "postponed", original="2026-10-10 15:30"),
    ]
    write_round(tmp_path, 5)
    assert "final:5" in keys(run_plan(at("2026-10-10 09:00"), games, tmp_path)[0])


def test_kulanz_fuer_verlegte_spiele_kommt_aus_season_json(tmp_path):
    """Mit 60 Tagen Kulanz zählt das 41 Tage verlegte Spiel noch; final:5 wartet darauf."""
    games = [
        dict(MD5[0], status="finished"),
        fixture(5, 503, "2026-11-20 20:30", "postponed", original="2026-10-10 15:30"),
    ]
    write_round(tmp_path, 5)
    now = at("2026-10-10 09:00")
    _, state = run_plan(now, [], tmp_path)
    tasks = plan(now, games, state, tmp_path, lambda: False, Earliest(), grace=timedelta(days=60))
    assert "final:5" not in keys(tasks)


def test_squads_montags_und_donnerstags_und_im_transferfenster_alle_zwei_tage(tmp_path):
    assert keys(plan(at("2026-10-05 09:59"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)) == []
    assert keys(plan(at("2026-10-05 10:00"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)) == ["squads:2026-10-05"]
    monday_done = {"done": {"squads:2026-10-05": "x"}}
    assert keys(plan(at("2026-10-07 12:00"), [], monday_done, tmp_path, lambda: False, Earliest(), grace=GRACE)) == []
    assert keys(plan(at("2026-10-08 10:00"), [], monday_done, tmp_path, lambda: False, Earliest(), grace=GRACE)) == ["squads:2026-10-08"]
    jan = plan(at("2027-01-12 10:00"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)
    assert keys(jan)[0].startswith("squads:2027-01-1")


def test_images_hoechstens_stuendlich(tmp_path):
    now = at("2026-10-07 09:00")
    tasks, state = run_plan(now, [], tmp_path, images_missing=True)
    assert keys(tasks) == ["images:2026-10-07T09"]
    record(state, tasks[0], now, "ok")
    assert keys(plan(at("2026-10-07 09:30"), [], state, tmp_path, lambda: True, Earliest(), grace=GRACE)) == []
    assert keys(plan(at("2026-10-07 10:00"), [], state, tmp_path, lambda: True, Earliest(), grace=GRACE)) == ["images:2026-10-07T10"]


def test_bilder_werden_ohne_offene_bilder_nur_einmal_pro_stunde_geprueft(tmp_path):
    checks = []

    def nothing_missing():
        checks.append(1)
        return False

    state = {}
    for minute in ("09:00", "09:05", "09:55"):
        plan(at(f"2026-10-07 {minute}"), [], state, tmp_path, nothing_missing, Earliest(), grace=GRACE)
    assert len(checks) == 1
    plan(at("2026-10-07 10:00"), [], state, tmp_path, nothing_missing, Earliest(), grace=GRACE)
    assert len(checks) == 2
    assert not any(k.startswith("images:") for k in state["planned"])


def test_fehlgeschlagene_jobs_werden_nach_drei_versuchen_aufgegeben(tmp_path):
    state = {"planned": {}, "done": {}}
    task = Task("final:3", "backfill", matchday=3)
    now = at("2026-09-26 11:00")
    for i in range(3):
        record(state, task, now + timedelta(minutes=15 * i), "failed", "HTTP 404 für u1")
    assert "final:3" in state["done"]
    gave_up = (now + timedelta(minutes=30)).isoformat()
    assert state["gaveUp"] == {"final:3": gave_up}
    assert state["lastJob"] == {"key": "final:3", "at": gave_up, "outcome": "failed", "error": "HTTP 404 für u1"}


def test_round_events_auch_nach_dem_anpfiff(tmp_path):
    assert "round:5" in keys(run_plan(at("2026-10-09 23:00"), MD5, tmp_path)[0])


def write_squads(tmp_path, day, team_ids, all_teams=(1, 2)):
    teams = tmp_path / "manual" / "teams.json"
    teams.parent.mkdir(parents=True, exist_ok=True)
    teams.write_text(json.dumps([{"id": t} for t in all_teams]))
    folder = tmp_path / "sofascore" / "squads" / day
    folder.mkdir(parents=True, exist_ok=True)
    for t in team_ids:
        (folder / f"{t}.json.gz").write_bytes(b"")


def test_squads_nicht_doppelt_wenn_schon_ein_stand_existiert(tmp_path):
    write_squads(tmp_path, "2026-10-05", [1, 2])
    assert keys(plan(at("2026-10-05 12:00"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)) == []
    assert keys(plan(at("2026-10-08 12:00"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)) == ["squads:2026-10-08"]


def test_squads_abgebrochener_stand_wird_fortgesetzt(tmp_path):
    """Pause nach einem Teil der Vereine: Der Tagesordner existiert, ist aber unvollständig."""
    write_squads(tmp_path, "2026-10-05", [1])
    assert keys(plan(at("2026-10-05 12:00"), [], {}, tmp_path, lambda: False, Earliest(), grace=GRACE)) == ["squads:2026-10-05"]


def test_status_nennt_pause_faellige_geplante_und_aufgegebene_jobs():
    now = at("2026-10-08 18:00")
    last_job = {"key": "round:5", "at": at("2026-10-06 10:00").isoformat(), "outcome": "ok", "error": None}
    state = {
        "done": {"round:5": "x", "final:4": "x"},
        "planned": {
            "round:5": at("2026-10-06 10:00").isoformat(),  # erledigt
            "squads:2026-10-08": at("2026-10-08 15:39").isoformat(),  # fällig, steht in due
            "prov:502": at("2026-10-10 17:45").isoformat(),
            "prov:501": at("2026-10-09 22:45").isoformat(),
        },
        "due": ["squads:2026-10-08", "round:5"],
        "attempts": {"squads:2026-10-08": 2},
        "gaveUp": {"final:4": at("2026-10-05 09:00").isoformat(), "final:3": at("2026-09-30 09:00").isoformat()},
        "lastJob": last_job,
    }
    pause = {
        "pauseUntil": at("2026-10-08 23:41").isoformat(),
        "pauseReason": "wiederholt 403/Bot-Challenge bei u1",
        "route": "page",
    }
    assert status(state, pause, now, "5cfb8a4", 1) == {
        "pause": {"until": at("2026-10-08 23:41").isoformat(), "reason": "wiederholt 403/Bot-Challenge bei u1"},
        "lastJob": last_job,
        "due": [{"key": "squads:2026-10-08", "attempts": 2}],
        "next": [
            {"key": "prov:501", "at": at("2026-10-09 22:45").isoformat()},
            {"key": "prov:502", "at": at("2026-10-10 17:45").isoformat()},
        ],
        # Älter als 7 Tage: nicht mehr gemeldet.
        "gaveUp": [{"key": "final:4", "at": at("2026-10-05 09:00").isoformat()}],
        "commit": "5cfb8a4",
        "unpushed": 1,
        "route": "page",
    }


def test_status_ohne_zustand_und_nach_abgelaufener_pause():
    now = at("2026-10-08 18:00")
    pause = {"pauseUntil": at("2026-10-08 17:59").isoformat()}
    assert status({}, pause, now, None, 0) == {
        "pause": None,
        "lastJob": None,
        "due": [],
        "next": [],
        "gaveUp": [],
        "commit": None,
        "unpushed": 0,
        "route": None,
    }


@pytest.fixture
def offline(tmp_path, monkeypatch):
    """run_once ohne Netz und ohne Git. Liefert die Lebenszeichen und die Liste der fälligen Jobs."""
    beats: list[dict] = []
    tasks: list[Task] = []
    monkeypatch.setattr(config, "STATE_DIR", tmp_path)
    monkeypatch.setattr(config, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(scheduler, "STATE_FILE", tmp_path / "scheduler.json")
    monkeypatch.setattr(scheduler, "LOCK_FILE", tmp_path / "scheduler.lock")
    monkeypatch.setattr(client, "STATE_FILE", tmp_path / "state.json")
    monkeypatch.setattr(client, "default_client", lambda: type("NoClient", (), {"close": lambda self: None})())
    monkeypatch.setattr(gitsync, "pull", lambda repo: None)
    monkeypatch.setattr(gitsync, "head", lambda repo: ("5cfb8a4", 0))
    monkeypatch.setattr(heartbeat, "send", beats.append)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "season.json").write_text('{"postponedGraceDays": 3}')

    def fake_plan(_now, _fixtures, state, *_rest, **_kw):
        state.setdefault("planned", {})
        state.setdefault("done", {})
        return tasks

    monkeypatch.setattr(scheduler, "plan", fake_plan)
    return beats, tasks


def test_lauf_meldet_sich_vor_und_nach_jedem_job_mit_dem_stand(tmp_path, monkeypatch, offline):
    """Zwei fällige Jobs, der erste scheitert, der zweite trifft auf die Pause."""
    now = at("2026-10-08 18:00")
    beats, tasks = offline
    tasks += [Task("squads:2026-10-08", "squads"), Task("images:2026-10-08T18", "images")]

    def execute(task, _client, _raw):
        if task.job == "squads":
            raise client.FetchError("u1", 404)
        (tmp_path / "state.json").write_text('{"pauseUntil": "2026-10-08T21:41:00+00:00", "pauseReason": "429 Too Many Requests"}')
        raise client.PauseRequired("429 Too Many Requests")

    monkeypatch.setattr(scheduler, "_execute", execute)

    assert scheduler.run_once(now) == 1
    first, after_job = beats
    assert first == status({}, {}, now, "5cfb8a4", 0)
    assert after_job["lastJob"]["outcome"] == "failed"
    assert after_job["lastJob"]["error"] == "HTTP 404 für u1"
    assert after_job["due"] == [{"key": "squads:2026-10-08", "attempts": 1}, {"key": "images:2026-10-08T18", "attempts": 0}]
    # Der nächste Lauf meldet die Pause gleich zu Beginn.
    tasks.clear()
    scheduler.run_once(now + timedelta(minutes=5))
    assert beats[2]["pause"] == {"until": "2026-10-08T21:41:00+00:00", "reason": "429 Too Many Requests"}
    assert beats[2]["due"] == [{"key": "squads:2026-10-08", "attempts": 1}, {"key": "images:2026-10-08T18", "attempts": 0}]


def test_unerwarteter_fehler_zaehlt_als_fehlversuch(tmp_path, monkeypatch, offline):
    """Ein Fehler außerhalb von FetchError (etwa ein geändertes Schema) darf den Job nicht
    bei jedem Aufruf alle 5 Min. neu starten (KONZEPT 5.6), und der nächste Job läuft weiter."""
    now = at("2026-10-08 18:00")
    beats, tasks = offline
    tasks += [Task("squads:2026-10-08", "squads"), Task("images:2026-10-08T18", "images")]
    ran: list[str] = []

    def execute(task, _client, _raw):
        ran.append(task.job)
        if task.job == "squads":
            raise KeyError("players")
        return "ok", ()

    monkeypatch.setattr(scheduler, "_execute", execute)

    assert scheduler.run_once(now) == 2
    assert ran == ["squads", "images"]
    state = scheduler.load_state(tmp_path / "scheduler.json")
    assert state["attempts"] == {"squads:2026-10-08": 1}
    assert "squads:2026-10-08" in state["planned"]
    assert "images:2026-10-08T18" in state["done"]
    assert beats[1]["lastJob"]["outcome"] == "failed"
    assert beats[1]["lastJob"]["error"] == "KeyError: 'players'"


CONTRACT = Path(__file__).parent / "fixtures" / "status-contract.json"


def test_status_vertrag_mit_der_app():
    """Das Lebenszeichen muss zum zod-Schema ScraperStatus passen (core/schemas/scraper.ts).
    Diese Datei prüft core/test/scraper-contract.test.ts gegen das Schema; ändert sich
    status(), mit FM_UPDATE_CONTRACT=1 neu schreiben und beide Tests laufen lassen."""
    now = datetime(2026, 10, 8, 16, 0, tzinfo=timezone.utc)
    state = {
        "planned": {"round:9": "2026-10-13T08:30:00+00:00", "squads:2026-10-08": "2026-10-08T15:30:00+00:00"},
        "done": {"squads:2026-10-05": "2026-10-05T09:00:00+00:00"},
        "due": ["squads:2026-10-08"],
        "attempts": {"squads:2026-10-08": 1},
        "lastJob": {"key": "squads:2026-10-08", "at": "2026-10-08T15:31:00+00:00", "outcome": "failed", "error": "KeyError: 'players'"},
        "gaveUp": {"final:3": "2026-10-06T07:00:00+00:00"},
    }
    pause = {"pauseUntil": "2026-10-08T21:31:00+00:00", "pauseReason": "429 Too Many Requests", "route": "page"}
    payload = status(state, pause, now, "5cfb8a4", 2)
    if os.environ.get("FM_UPDATE_CONTRACT"):
        CONTRACT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    assert payload == json.loads(CONTRACT.read_text())
