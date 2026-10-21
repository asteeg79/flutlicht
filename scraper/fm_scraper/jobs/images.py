"""Job images: Vereinslogos und Spielerbilder als 128-px-WebP (KONZEPT 5.5, 6.3).

Höchstens 60 Bilder pro Lauf, Läufe höchstens stündlich. Vorhandene Bilder werden
übersprungen; Logos kommen zuerst. Die Spieler-IDs stammen aus den Kaderdateien.
Jedes Bild wird nur einmal abgefragt (5.5 „einmalig“): Wer kein Foto hat (404),
kommt nach `raw/sofascore/images-missing.json`. Löschen der Datei fragt erneut ab.
Ein 403 heißt „Script gesperrt“, nicht „kein Foto“: Der Client wechselt auf den Browser.
"""

import io
import json
from pathlib import Path

from .. import config
from ..client import Client, FetchError
from ..raw import read_raw


def wanted(raw_dir: Path, teams: list[dict]) -> list[tuple[str, int]]:
    """(Art, ID) aller Bilder: erst die 18 Logos, dann alle Spieler aus den Kadern."""
    items: list[tuple[str, int]] = [("clubs", t["id"]) for t in teams]
    player_ids: set[int] = set()
    for squad in sorted((raw_dir / "sofascore" / "squads").glob("*/*.json.gz")):
        data = read_raw(squad)
        player_ids.update(p["player"]["id"] for p in data["players"])
    items += [("players", pid) for pid in sorted(player_ids)]
    return items


def _missing_file(raw_dir: Path) -> Path:
    return raw_dir / "sofascore" / "images-missing.json"


def _read_missing(raw_dir: Path) -> set[str]:
    path = _missing_file(raw_dir)
    return set(json.loads(path.read_text())) if path.exists() else set()


def todo(raw_dir: Path, img_dir: Path, teams: list[dict]) -> list[tuple[str, int]]:
    """Bilder, die weder vorhanden noch als „kein Foto“ vermerkt sind."""
    missing = _read_missing(raw_dir)
    return [
        (kind, id_)
        for kind, id_ in wanted(raw_dir, teams)
        if f"{kind}/{id_}" not in missing and not (img_dir / kind / f"{id_}.webp").exists()
    ]


def to_webp(image: bytes, size: int) -> bytes:
    from PIL import Image

    with Image.open(io.BytesIO(image)) as img:
        img = img.convert("RGBA")
        img.thumbnail((size, size))
        out = io.BytesIO()
        img.save(out, "WEBP", quality=85)
        return out.getvalue()


def run(client: Client, raw_dir: Path, img_dir: Path, teams: list[dict]) -> list[Path]:
    written: list[Path] = []
    missing = _read_missing(raw_dir)
    # Das Limit zählt Abrufe, auch die ohne Bild (5.5: höchstens 60 pro Stunde).
    for kind, id_ in todo(raw_dir, img_dir, teams)[: config.IMAGES_PER_RUN]:
        path = img_dir / kind / f"{id_}.webp"
        try:
            image = client.get_bytes(f"{config.API}/{'team' if kind == 'clubs' else 'player'}/{id_}/image")
        except FetchError as e:
            if e.status != 404:
                raise
            # 404: kein Foto → die App zeigt eine Silhouette.
            missing.add(f"{kind}/{id_}")
            _missing_file(raw_dir).parent.mkdir(parents=True, exist_ok=True)
            _missing_file(raw_dir).write_text(json.dumps(sorted(missing), indent=2) + "\n")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(to_webp(image, config.IMAGE_SIZE))
        written.append(path)
    return written
