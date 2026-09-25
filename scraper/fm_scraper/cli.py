"""Kommandozeile: python -m fm_scraper run <job> [--matchday N] [--event ID] [--no-sync]."""

import argparse
import logging

from . import config, gitsync
from .client import PauseRequired, default_client
from .jobs import match_final, round_events

JOBS = ("round-events", "match-final")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fm_scraper")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="einen Job manuell ausführen")
    run.add_argument("job", choices=JOBS)
    run.add_argument("--matchday", type=int, required=True)
    run.add_argument("--event", type=int, help="nur dieses Spiel (match-final)")
    run.add_argument("--no-sync", action="store_true", help="nicht committen und pushen")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = default_client()
    try:
        if args.job == "round-events":
            written = round_events.run(client, config.RAW_DIR, args.matchday)
        else:
            written = match_final.run(client, config.RAW_DIR, args.matchday, args.event)
    except PauseRequired as e:
        logging.warning("Abgebrochen: %s", e)
        return 2
    finally:
        client.close()
    for path in written:
        logging.info("geschrieben: %s", path.relative_to(config.REPO_ROOT))
    if not args.no_sync:
        gitsync.sync(config.REPO_ROOT, args.job)
    return 0
