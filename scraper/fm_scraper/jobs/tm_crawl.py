"""Job tm-crawl: Marktwerte über den lokalen transfermarkt-api-Dienst (19 Abrufe, KONZEPT 5.4).

Der Dienst läuft per Docker auf dem Heim-Rechner (siehe scraper/README.md).
Abstand 60–180 s. Scheitert der Crawl, gilt dcaribou → Sofascore → Admin.
"""

from datetime import date
from pathlib import Path

from .. import config
from ..client import Client
from ..raw import write_raw


def run(client: Client, raw_dir: Path, today: date) -> list[Path]:
    day_dir = raw_dir / "transfermarkt" / today.isoformat()
    clubs_path = day_dir / "clubs.json"
    url = f"{config.TM_API}/competitions/L1/clubs"
    clubs = client.get_json(url)
    write_raw(clubs_path, url, "tm-crawl", clubs)
    written = [clubs_path]
    for club in clubs["clubs"]:
        path = day_dir / f"club-{club['id']}.json"
        url = f"{config.TM_API}/clubs/{club['id']}/players"
        write_raw(path, url, "tm-crawl", client.get_json(url))
        written.append(path)
    return written
