"""Die eine Weiche für CLI und Scheduler: je Job, was er braucht, womit er abruft und
was danach committet wird."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Callable, Literal
from zoneinfo import ZoneInfo

from . import config
from .client import Client
from .jobs import backfill, dcaribou, images, match_final, match_provisional, round_events, squads, tm_crawl
from .teams import load_teams


@dataclass(frozen=True)
class Args:
    matchday: int | None
    event: int | None
    today: date


@dataclass(frozen=True)
class Job:
    # Rückgabe: geschriebene Dateien und ob das Spiel fertig ist (nur match-provisional
    # kann False melden, dann ist ein neuer Versuch fällig).
    run: Callable[[Client, Path, Args], tuple[list[Path], bool]]
    needs: tuple[Literal["matchday", "event"], ...] = ()
    # "sofascore": Browser mit Rückfallwegen und gemeinsamer Pause; "tm": eigener HTTP-Client.
    client: Literal["sofascore", "tm"] = "sofascore"
    commit: tuple[str, ...] = ("raw",)


def _done(paths: list[Path]) -> tuple[list[Path], bool]:
    return paths, True


JOBS: dict[str, Job] = {
    "round-events": Job(lambda c, raw, a: _done(round_events.run(c, raw, a.matchday)), needs=("matchday",)),
    "match-provisional": Job(lambda c, raw, a: match_provisional.run(c, raw, a.event), needs=("event",)),
    "match-final": Job(lambda c, raw, a: _done(match_final.run(c, raw, a.matchday, a.event)), needs=("matchday",)),
    "backfill": Job(lambda c, raw, a: _done(backfill.run(c, raw, a.matchday)), needs=("matchday",)),
    "squads": Job(lambda c, raw, a: _done(squads.run(c, raw, load_teams(config.TEAMS_FILE), a.today))),
    "dcaribou": Job(lambda c, raw, a: _done(dcaribou.run(c, raw))),
    "tm-crawl": Job(lambda c, raw, a: _done(tm_crawl.run(c, raw, a.today)), client="tm"),
    # Bilder liegen zusätzlich in der App.
    "images": Job(
        lambda c, raw, a: _done(images.run(c, raw, config.IMG_DIR, load_teams(config.TEAMS_FILE))),
        commit=("app/public/img", "raw"),
    ),
}


def missing(job: str, matchday: int | None, event: int | None) -> str | None:
    """Fehlendes Pflichtargument als Meldung, sonst None."""
    given = {"matchday": matchday, "event": event}
    for name in JOBS[job].needs:
        if given[name] is None:
            return f"{job} braucht --{name}"
    return None


def run_job(
    job: str, client: Client, raw: Path, matchday: int | None = None, event: int | None = None
) -> tuple[list[Path], bool]:
    """Führt einen Job aus. Rückgabe: geschriebene Dateien und ob das Spiel fertig ist."""
    if job not in JOBS:
        raise SystemExit(f"unbekannter Job: {job}")
    problem = missing(job, matchday, event)
    if problem:
        raise SystemExit(problem)
    today = datetime.now(ZoneInfo(config.TIMEZONE)).date()
    return JOBS[job].run(client, raw, Args(matchday, event, today))


def commit_paths(job: str) -> tuple[str, ...]:
    return JOBS[job].commit


def client_for(job: str) -> Callable[[], Client]:
    """Fabrik des Clients, mit dem der Job abruft."""
    from .client import default_client, tm_client

    return tm_client if JOBS[job].client == "tm" else default_client
