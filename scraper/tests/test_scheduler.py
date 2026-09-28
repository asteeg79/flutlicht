"""Scheduler-Entscheidungen mit fester Uhr (KONZEPT 10: Zeitfenster, Retries, Nachtpause)."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fm_scraper.scheduler import Task, plan, record

BERLIN = ZoneInfo("Europe/Berlin")


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
    # squads der Woche als erledigt markieren, damit es die übrigen Fälle nicht stört
    week = now.astimezone(BERLIN).date()
    wednesday = week - timedelta(days=(week.weekday() - 2) % 7)
    state.setdefault("done", {})[f"squads:{wednesday.isocalendar().year}-W{wednesday.isocalendar().week:02d}"] = "x"
    return plan(now, fixtures, state, tmp_path, lambda: images_missing, Earliest()), state


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
    assert "prov:501" not in keys(plan(now + timedelta(minutes=14), MD5, state, tmp_path, lambda: False, Earliest()))
    assert "prov:501" in keys(plan(now + timedelta(minutes=15), MD5, state, tmp_path, lambda: False, Earliest()))
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


def test_backfill_ein_spieltag_pro_tag(tmp_path):
    old = [fixture(3, 301, "2026-09-12 15:30", "finished", "pending"), fixture(4, 401, "2026-09-19 15:30", "finished", "pending")]
    now = at("2026-09-26 11:00")
    tasks, state = run_plan(now, old, tmp_path)
    assert tasks == [Task("final:3", "backfill", matchday=3)]
    record(state, tasks[0], now, "ok")
    assert keys(plan(now + timedelta(hours=1), old, state, tmp_path, lambda: False, Earliest())) == []
    assert "final:4" in keys(plan(at("2026-09-27 08:00"), old, state, tmp_path, lambda: False, Earliest()))


def test_verlegte_spiele_halten_die_finalisierung_nicht_auf(tmp_path):
    games = [
        dict(MD5[0], status="finished"),
        fixture(5, 503, "2026-11-20 20:30", "postponed", original="2026-10-10 15:30"),
    ]
    write_round(tmp_path, 5)
    assert "final:5" in keys(run_plan(at("2026-10-10 09:00"), games, tmp_path)[0])


def test_squads_mittwochs_und_im_transferfenster_alle_zwei_tage(tmp_path):
    assert keys(plan(at("2026-10-07 09:59"), [], {}, tmp_path, lambda: False, Earliest())) == []
    assert keys(plan(at("2026-10-07 10:00"), [], {}, tmp_path, lambda: False, Earliest())) == ["squads:2026-W41"]
    jan = plan(at("2027-01-12 10:00"), [], {}, tmp_path, lambda: False, Earliest())
    assert keys(jan)[0].startswith("squads:2027-01-1")


def test_images_hoechstens_stuendlich(tmp_path):
    now = at("2026-10-07 09:00")
    tasks, state = run_plan(now, [], tmp_path, images_missing=True)
    assert keys(tasks) == ["images:2026-10-07T09"]
    record(state, tasks[0], now, "ok")
    assert keys(plan(at("2026-10-07 09:30"), [], state, tmp_path, lambda: True, Earliest())) == []
    assert keys(plan(at("2026-10-07 10:00"), [], state, tmp_path, lambda: True, Earliest())) == ["images:2026-10-07T10"]


def test_bilder_werden_ohne_offene_bilder_nur_einmal_pro_stunde_geprueft(tmp_path):
    checks = []

    def nothing_missing():
        checks.append(1)
        return False

    state = {}
    for minute in ("09:00", "09:05", "09:55"):
        plan(at(f"2026-10-07 {minute}"), [], state, tmp_path, nothing_missing, Earliest())
    assert len(checks) == 1
    plan(at("2026-10-07 10:00"), [], state, tmp_path, nothing_missing, Earliest())
    assert len(checks) == 2
    assert not any(k.startswith("images:") for k in state["planned"])


def test_fehlgeschlagene_jobs_werden_nach_drei_versuchen_aufgegeben(tmp_path):
    state = {"planned": {}, "done": {}}
    task = Task("final:3", "backfill", matchday=3)
    now = at("2026-09-26 11:00")
    for i in range(3):
        record(state, task, now + timedelta(minutes=15 * i), "failed")
    assert "final:3" in state["done"]


def test_round_events_auch_nach_dem_anpfiff(tmp_path):
    assert "round:5" in keys(run_plan(at("2026-10-09 23:00"), MD5, tmp_path)[0])


def test_squads_nicht_doppelt_wenn_schon_ein_stand_existiert(tmp_path):
    (tmp_path / "sofascore" / "squads" / "2026-10-07").mkdir(parents=True)
    assert keys(plan(at("2026-10-07 12:00"), [], {}, tmp_path, lambda: False, Earliest())) == []
    assert keys(plan(at("2026-10-14 12:00"), [], {}, tmp_path, lambda: False, Earliest())) == ["squads:2026-W42"]
