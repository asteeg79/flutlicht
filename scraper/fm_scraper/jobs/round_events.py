"""Job round-events: Event-IDs eines Spieltags (1 Abruf, KONZEPT 5.5)."""

from pathlib import Path

from .. import config
from ..client import Client
from ..raw import write_raw


def round_path(raw_dir: Path, matchday: int) -> Path:
    return raw_dir / "sofascore" / "rounds" / f"round-{matchday:02d}.json"


def run(client: Client, raw_dir: Path, matchday: int) -> list[Path]:
    url = (
        f"{config.API}/unique-tournament/{config.TOURNAMENT_ID}"
        f"/season/{config.SEASON_ID}/events/round/{matchday}"
    )
    path = round_path(raw_dir, matchday)
    write_raw(path, url, "round", client.get_json(url))
    return [path]
