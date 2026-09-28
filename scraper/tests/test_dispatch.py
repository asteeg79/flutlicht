"""Eine Weiche für CLI und Scheduler: welcher Job mit welchen Argumenten läuft."""

from pathlib import Path

import pytest

from fm_scraper import dispatch
from fm_scraper.jobs import match_final, match_provisional, round_events


def test_reicht_spieltag_und_spiel_durch(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(round_events, "run", lambda c, raw, md: calls.append(("round", raw, md)) or [Path("a")])
    monkeypatch.setattr(match_final, "run", lambda c, raw, md, ev: calls.append(("final", md, ev)) or [])
    assert dispatch.run_job("round-events", None, tmp_path, matchday=5) == ([Path("a")], True)
    assert dispatch.run_job("match-final", None, tmp_path, matchday=5, event=77) == ([], True)
    assert calls == [("round", tmp_path, 5), ("final", 5, 77)]


def test_vorlaeufig_meldet_ob_das_spiel_fertig_ist(monkeypatch, tmp_path):
    monkeypatch.setattr(match_provisional, "run", lambda c, raw, ev: ([], False))
    assert dispatch.run_job("match-provisional", None, tmp_path, event=1) == ([], False)


def test_pflichtargumente(tmp_path):
    with pytest.raises(SystemExit):
        dispatch.run_job("match-provisional", None, tmp_path)
    with pytest.raises(SystemExit):
        dispatch.run_job("backfill", None, tmp_path)


def test_bilder_committen_auch_die_bilddateien():
    assert dispatch.commit_paths("images") == ("app/public/img", "raw")
    assert dispatch.commit_paths("squads") == ("raw",)
