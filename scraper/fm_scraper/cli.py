"""Kommandozeile: python -m fm_scraper run <job> [--matchday N] [--event ID] [--no-sync]
bzw. python -m fm_scraper schedule (vom Timer alle 5 Min.)."""

import argparse
import logging

from . import config, gitsync
from .client import PauseRequired
from .dispatch import JOBS, client_for, commit_paths, missing, run_job


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fm_scraper")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="einen Job manuell ausführen")
    run.add_argument("job", choices=JOBS)
    run.add_argument("--matchday", type=int)
    run.add_argument("--event", type=int, help="nur dieses Spiel (match-final, match-provisional)")
    run.add_argument("--no-sync", action="store_true", help="nicht committen und pushen")
    sub.add_parser("schedule", help="fällige Jobs ausführen (Timer, alle 5 Min.)")
    args = parser.parse_args(argv)
    if args.command == "schedule":
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        from .scheduler import run_once

        run_once()
        return 0
    problem = missing(args.job, args.matchday, args.event)
    if problem:
        parser.error(problem)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    client = client_for(args.job)()
    try:
        written, _ = run_job(args.job, client, config.RAW_DIR, args.matchday, args.event)
    except PauseRequired as e:
        logging.warning("Abgebrochen: %s", e)
        return 2
    finally:
        client.close()
    for path in written:
        logging.info("geschrieben: %s", path.relative_to(config.REPO_ROOT))
    if not args.no_sync:
        gitsync.sync(config.REPO_ROOT, args.job, commit_paths(args.job))
    return 0
