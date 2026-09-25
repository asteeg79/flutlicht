"""Kommandozeile: python -m fm_scraper run <job> [--matchday N] [--event ID] [--no-sync]."""

import argparse
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from . import config, gitsync
from .client import Client, PauseRequired, default_client, tm_client
from .jobs import backfill, dcaribou, images, match_final, round_events, squads, tm_crawl
from .teams import load_teams

JOBS = ("round-events", "match-final", "backfill", "squads", "dcaribou", "tm-crawl", "images")
NEEDS_MATCHDAY = {"round-events", "match-final", "backfill"}


def _run_job(args: argparse.Namespace, client: Client):
    today = datetime.now(ZoneInfo(config.TIMEZONE)).date()
    raw = config.RAW_DIR
    match args.job:
        case "round-events":
            return round_events.run(client, raw, args.matchday)
        case "match-final":
            return match_final.run(client, raw, args.matchday, args.event)
        case "backfill":
            return backfill.run(client, raw, args.matchday)
        case "squads":
            return squads.run(client, raw, load_teams(config.TEAMS_FILE), today)
        case "dcaribou":
            return dcaribou.run(client, raw)
        case "tm-crawl":
            return tm_crawl.run(client, raw, today)
        case "images":
            return images.run(client, raw, config.IMG_DIR, load_teams(config.TEAMS_FILE))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fm_scraper")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="einen Job manuell ausführen")
    run.add_argument("job", choices=JOBS)
    run.add_argument("--matchday", type=int)
    run.add_argument("--event", type=int, help="nur dieses Spiel (match-final)")
    run.add_argument("--no-sync", action="store_true", help="nicht committen und pushen")
    args = parser.parse_args(argv)
    if args.job in NEEDS_MATCHDAY and args.matchday is None:
        parser.error(f"{args.job} braucht --matchday")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = tm_client() if args.job == "tm-crawl" else default_client()
    try:
        written = _run_job(args, client)
    except PauseRequired as e:
        logging.warning("Abgebrochen: %s", e)
        return 2
    finally:
        client.close()
    for path in written:
        logging.info("geschrieben: %s", path.relative_to(config.REPO_ROOT))
    if not args.no_sync:
        paths = ("app/public/img",) if args.job == "images" else ("raw",)
        gitsync.sync(config.REPO_ROOT, args.job, paths)
    return 0
