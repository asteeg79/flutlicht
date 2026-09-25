"""Job images: Vereinslogos und Spielerbilder als 128-px-WebP (KONZEPT 5.5, 6.3).

Höchstens 60 Bilder pro Lauf, Läufe höchstens stündlich. Vorhandene Bilder werden
übersprungen; Logos kommen zuerst. Die Spieler-IDs stammen aus den Kaderdateien.
"""

import io
import json
from pathlib import Path

from .. import config
from ..client import Client, FetchError


def wanted(raw_dir: Path, teams: list[dict]) -> list[tuple[str, int]]:
    """(Art, ID) aller Bilder: erst die 18 Logos, dann alle Spieler aus den Kadern."""
    items: list[tuple[str, int]] = [("clubs", t["id"]) for t in teams]
    player_ids: set[int] = set()
    for squad in sorted((raw_dir / "sofascore" / "squads").glob("*/*.json")):
        data = json.loads(squad.read_text(encoding="utf-8"))["data"]
        player_ids.update(p["player"]["id"] for p in data["players"])
    items += [("players", pid) for pid in sorted(player_ids)]
    return items


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
    for kind, id_ in wanted(raw_dir, teams):
        if len(written) >= config.IMAGES_PER_RUN:
            break
        path = img_dir / kind / f"{id_}.webp"
        if path.exists():
            continue
        try:
            image = client.get_bytes(f"{config.IMAGE_API}/{'team' if kind == 'clubs' else 'player'}/{id_}/image")
        except FetchError as e:
            if e.status != 404:
                raise
            continue  # kein Bild vorhanden → die App zeigt eine Silhouette
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(to_webp(image, config.IMAGE_SIZE))
        written.append(path)
    return written
