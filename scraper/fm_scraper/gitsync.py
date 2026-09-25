"""Git-Abgleich nach jedem Job (KONZEPT 5.5, 6.4): pull --rebase, commit raw/, push, 3 Versuche."""

import logging
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

log = logging.getLogger(__name__)

ATTEMPTS = 3


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)


def sync(repo: Path, job: str, sleep: Callable[[float], None] = time.sleep) -> bool:
    """Committet raw/ und pusht. Gibt False zurück, wenn es nichts zu committen gab."""
    _git(repo, "add", "raw")
    if _git(repo, "diff", "--staged", "--quiet").returncode == 0:
        log.info("Keine neuen Rohdaten, nichts zu committen")
        return False
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    commit = _git(repo, "commit", "-m", f"raw: {job} {stamp}")
    if commit.returncode != 0:
        raise RuntimeError(f"git commit fehlgeschlagen: {commit.stderr.strip()}")
    for attempt in range(1, ATTEMPTS + 1):
        pull = _git(repo, "pull", "--rebase", "--autostash", "-X", "theirs")
        if pull.returncode != 0:
            _git(repo, "rebase", "--abort")
        push = _git(repo, "push")
        if push.returncode == 0:
            return True
        log.warning("Push-Versuch %d/%d fehlgeschlagen: %s", attempt, ATTEMPTS, push.stderr.strip())
        if attempt < ATTEMPTS:
            sleep(10 * attempt)
    raise RuntimeError("Push nach 3 Versuchen fehlgeschlagen")
