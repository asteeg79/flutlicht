"""Scheduler für den Heim-Rechner (KONZEPT 5.5, 10): wird alle 5 Min. aufgerufen.

Entscheidet rein lokal, welche Jobs fällig sind; nur Jobs erzeugen Abrufe. Die
zufälligen Zeitpunkte werden einmal pro Job gezogen und im Zustand gespeichert,
damit sie bei jedem Aufruf gleich bleiben. Nachts (00–07 Uhr) läuft nichts.
"""

from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

from . import config
from .jobs.round_events import round_path

log = logging.getLogger(__name__)
BERLIN = ZoneInfo(config.TIMEZONE)

PROVISIONAL_MINUTES = (135, 155)
PROVISIONAL_RETRY = timedelta(minutes=15)
PROVISIONAL_ATTEMPTS = 3
FAILED_ATTEMPTS = 3
TRANSFER_MONTHS = {1, 7, 8}
POSTPONED_GRACE = timedelta(days=3)
# Vorläufige Daten nur bis zur Finalisierung am Folgemorgen; ältere Lücken füllt match-final/backfill.
PROVISIONAL_WINDOW = timedelta(hours=24)


@dataclass(frozen=True)
class Task:
    key: str
    job: str
    matchday: int | None = None
    event: int | None = None


def _at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=BERLIN)


def _random_between(rng: random.Random, start: datetime, end: datetime) -> datetime:
    return start + timedelta(seconds=rng.uniform(0, (end - start).total_seconds()))


def _out_of_night(t: datetime, rng: random.Random) -> datetime:
    """Zeitpunkte zwischen 00 und 07 Uhr auf 07:05–07:35 desselben Morgens schieben."""
    local = t.astimezone(BERLIN)
    start, end = config.NIGHT_HOURS
    if start <= local.hour < end:
        return _random_between(rng, _at(local.date(), end, 5), _at(local.date(), end, 35))
    return t


def _kickoff(f: dict) -> datetime:
    return datetime.fromisoformat(f["kickoffUtc"].replace("Z", "+00:00"))


def _counts(f: dict) -> bool:
    original = datetime.fromisoformat(f["originalKickoffUtc"].replace("Z", "+00:00"))
    return _kickoff(f) - original <= POSTPONED_GRACE


def _has_final(raw_dir: Path, event_id: int | None) -> bool:
    return event_id is not None and (raw_dir / "sofascore" / "matches" / str(event_id) / "final" / "incidents.json").exists()


def plan(
    now: datetime,
    fixtures: list[dict],
    state: dict[str, Any],
    raw_dir: Path,
    images_missing: Callable[[], bool],
    rng: random.Random,
) -> list[Task]:
    """Fällige Aufgaben; ergänzt state["planned"] um neu gezogene Zeitpunkte."""
    planned: dict[str, str] = state.setdefault("planned", {})
    done: dict[str, str] = state.setdefault("done", {})
    local_now = now.astimezone(BERLIN)
    if config.NIGHT_HOURS[0] <= local_now.hour < config.NIGHT_HOURS[1]:
        return []

    def when(key: str, draw: Callable[[], datetime]) -> datetime:
        if key not in planned:
            planned[key] = _out_of_night(draw(), rng).astimezone(timezone.utc).isoformat()
        return datetime.fromisoformat(planned[key])

    tasks: list[Task] = []
    by_md: dict[int, list[dict]] = {}
    for f in fixtures:
        by_md.setdefault(f["matchday"], []).append(f)

    # round-events: Dienstag 10–14 Uhr vor dem nächsten Spieltag ohne Round-Datei.
    for md in sorted(by_md):
        games = by_md[md]
        if all(f["status"] == "finished" for f in games):
            continue
        if round_path(raw_dir, md).exists():
            break
        first = min(_kickoff(f) for f in games)
        if first - now > timedelta(days=8):
            break
        kick_day = first.astimezone(BERLIN).date()
        tuesday = max(kick_day - timedelta(days=(kick_day.weekday() - 1) % 7), local_now.date())
        key = f"round:{md}"
        t = when(key, lambda: _random_between(rng, _at(tuesday, 10), _at(tuesday, 14)))
        # Auch nach dem Anpfiff noch holen: ohne Event-IDs gibt es weder vorläufige noch finale Daten.
        if key not in done and t <= now:
            tasks.append(Task(key, "round-events", matchday=md))
        break

    # match-provisional: Anpfiff + 135–155 Min., bis zu 3 Versuche im Abstand von 15 Min.,
    # nur innerhalb von 24 h nach Anpfiff.
    for f in fixtures:
        event = f.get("sofascoreEventId")
        if event is None or f["status"] == "postponed" or f["dataState"] not in ("none", "pending"):
            continue
        key = f"prov:{event}"
        if key in done or _has_final(raw_dir, event):
            continue
        kickoff = _kickoff(f)
        if kickoff > now or now - kickoff > PROVISIONAL_WINDOW:
            continue
        t = when(key, lambda k=kickoff: k + timedelta(minutes=rng.uniform(*PROVISIONAL_MINUTES)))
        if t <= now:
            tasks.append(Task(key, "match-provisional", matchday=f["matchday"], event=event))

    # match-final bzw. backfill: höchstens ein Spieltag pro Tag, am Morgen nach dem letzten Spiel 08–10 Uhr.
    finals_today = any(k.startswith("final:") and datetime.fromisoformat(v).astimezone(BERLIN).date() == local_now.date() for k, v in done.items())
    for md in sorted(by_md):
        games = [f for f in by_md[md] if _counts(f)]
        if not games or not all(f["status"] == "finished" for f in games):
            continue
        if all(_has_final(raw_dir, f.get("sofascoreEventId")) for f in games):
            continue
        key = f"final:{md}"
        if key in done:
            continue  # versucht (ggf. aufgegeben); nicht die späteren Spieltage blockieren
        if finals_today:
            break
        last = max(_kickoff(f) for f in games).astimezone(BERLIN).date()
        day = max(last + timedelta(days=1), local_now.date())
        t = when(key, lambda d=day: _random_between(rng, _at(d, 8), _at(d, 10)))
        if t <= now:
            has_round = round_path(raw_dir, md).exists()
            tasks.append(Task(key, "match-final" if has_round else "backfill", matchday=md))
        break

    # squads: mittwochs 10–18 Uhr; im Transferfenster (Jan., Juli, Aug.) alle 2 Tage.
    today = local_now.date()
    if today.month in TRANSFER_MONTHS:
        day = date.fromordinal(today.toordinal() - today.toordinal() % 2)
        key = f"squads:{day.isoformat()}"
    else:
        day = today - timedelta(days=(today.weekday() - 2) % 7)
        key = f"squads:{day.isocalendar().year}-W{day.isocalendar().week:02d}"
    t = when(key, lambda: _random_between(rng, _at(day, 10), _at(day, 18)))
    snapshots = raw_dir / "sofascore" / "squads"
    latest = max((p.name for p in snapshots.iterdir() if p.is_dir()), default="") if snapshots.exists() else ""
    # Ein Kader-Stand ab dem geplanten Tag (etwa von Hand geholt) gilt als erledigt.
    if key not in done and t <= now and latest < day.isoformat():
        tasks.append(Task(key, "squads"))

    # images: fehlende Bilder, höchstens ein Lauf pro Stunde. Die Prüfung liest alle Kader;
    # ist nichts offen, gilt das bis zur nächsten Stunde.
    key = f"images:{local_now.strftime('%Y-%m-%dT%H')}"
    if key not in done and state.get("imagesComplete") != key:
        if images_missing():
            hour = local_now.replace(minute=0, second=0, microsecond=0)
            t = when(key, lambda: _random_between(rng, hour, hour + timedelta(minutes=40)))
            if t <= now:
                tasks.append(Task(key, "images"))
        else:
            state["imagesComplete"] = key

    return tasks


def record(state: dict[str, Any], task: Task, now: datetime, outcome: str) -> None:
    """Ergebnis eines Jobs vermerken: ok, unfinished (Spiel läuft noch) oder failed."""
    attempts: dict[str, int] = state.setdefault("attempts", {})
    if outcome == "ok":
        state["done"][task.key] = now.isoformat()
        attempts.pop(task.key, None)
        return
    n = attempts.get(task.key, 0) + 1
    attempts[task.key] = n
    limit = PROVISIONAL_ATTEMPTS if outcome == "unfinished" else FAILED_ATTEMPTS
    if n >= limit:
        log.warning("%s nach %d Versuchen aufgegeben", task.key, n)
        state["done"][task.key] = now.isoformat()
    else:
        state["planned"][task.key] = (now + PROVISIONAL_RETRY).astimezone(timezone.utc).isoformat()


def load_state(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text()) if path.exists() else {}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True))


# --- Ausführung (vom systemd-Timer bzw. launchd alle 5 Min. aufgerufen) ---

PULL_EVERY = timedelta(minutes=30)
STATE_FILE = config.STATE_DIR / "scheduler.json"
LOCK_FILE = config.STATE_DIR / "scheduler.lock"


def _images_missing(raw_dir: Path, img_dir: Path, teams: list[dict]) -> bool:
    from .jobs import images

    return bool(images.todo(raw_dir, img_dir, teams))


def _execute(task: Task, client, raw_dir: Path) -> tuple[str, tuple[str, ...]]:
    """Führt einen Job aus; Rückgabe: Ergebnis und die zu committenden Pfade."""
    from .dispatch import commit_paths, run_job

    _, finished = run_job(task.job, client, raw_dir, task.matchday, task.event)
    return ("ok" if finished else "unfinished"), commit_paths(task.job)


def run_once(now: datetime | None = None) -> int:
    """Ein Scheduler-Lauf. Rückgabe: Anzahl ausgeführter Jobs."""
    import fcntl

    from . import gitsync
    from .client import FetchError, PauseRequired, default_client
    from .teams import load_teams

    now = now or datetime.now(timezone.utc)
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOCK_FILE, "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log.info("Scheduler läuft schon, dieser Aufruf endet")
            return 0

        state = load_state(STATE_FILE)
        last_pull = state.get("lastPull")
        if last_pull is None or now - datetime.fromisoformat(last_pull) >= PULL_EVERY:
            gitsync.pull(config.REPO_ROOT)
            state["lastPull"] = now.isoformat()

        fixtures_path = config.REPO_ROOT / "data" / "fixtures.json"
        fixtures = json.loads(fixtures_path.read_text()) if fixtures_path.exists() else []
        tasks = plan(
            now,
            fixtures,
            state,
            config.RAW_DIR,
            lambda: _images_missing(config.RAW_DIR, config.IMG_DIR, load_teams(config.TEAMS_FILE)),
            random.Random(),
        )
        save_state(STATE_FILE, state)
        if not tasks:
            return 0

        client = default_client()
        ran = 0
        try:
            for task in tasks:
                log.info("Job %s (%s)", task.job, task.key)
                try:
                    outcome, paths = _execute(task, client, config.RAW_DIR)
                except PauseRequired as e:
                    log.warning("Abbruch aller Jobs: %s", e)
                    break
                except (FetchError, SystemExit) as e:
                    log.warning("%s fehlgeschlagen: %s", task.key, e)
                    outcome, paths = "failed", ()
                record(state, task, datetime.now(timezone.utc), outcome)
                save_state(STATE_FILE, state)
                if paths:
                    gitsync.sync(config.REPO_ROOT, task.job, paths)
                ran += 1
        finally:
            client.close()
        return ran
