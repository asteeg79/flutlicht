import subprocess

from fm_scraper import gitsync


def git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def setup_repos(tmp_path):
    remote = tmp_path / "remote.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(remote))
    work = tmp_path / "work"
    git(tmp_path, "clone", "-q", str(remote), str(work))
    git(work, "config", "user.email", "t@example.org")
    git(work, "config", "user.name", "Test")
    (work / "README").write_text("x")
    git(work, "add", ".")
    git(work, "commit", "-q", "-m", "init")
    git(work, "push", "-q", "-u", "origin", "main")
    return remote, work


def test_committet_und_pusht_raw(tmp_path):
    remote, work = setup_repos(tmp_path)
    (work / "raw").mkdir()
    (work / "raw" / "a.json").write_text("{}")
    (work / "other.txt").write_text("nicht committen")
    assert gitsync.sync(work, "round-events") is True
    log = subprocess.run(["git", "log", "--format=%s", "main"], cwd=remote, capture_output=True, text=True)
    assert log.stdout.startswith("raw: round-events ")
    files = subprocess.run(["git", "ls-tree", "-r", "--name-only", "main"], cwd=remote, capture_output=True, text=True)
    assert "raw/a.json" in files.stdout
    assert "other.txt" not in files.stdout


def test_ohne_aenderungen_kein_commit(tmp_path):
    _, work = setup_repos(tmp_path)
    assert gitsync.sync(work, "round-events") is False


def test_committet_nur_die_angegebenen_pfade(tmp_path):
    remote, work = setup_repos(tmp_path)
    (work / "raw").mkdir()
    (work / "raw" / "a.json").write_text("{}")
    (work / "img").mkdir()
    (work / "img" / "1.webp").write_text("x")
    assert gitsync.sync(work, "images", ("img",)) is True
    files = subprocess.run(["git", "ls-tree", "-r", "--name-only", "main"], cwd=remote, capture_output=True, text=True)
    assert "img/1.webp" in files.stdout
    assert "raw/a.json" not in files.stdout


def test_committet_keine_fremden_gestagten_dateien(tmp_path):
    remote, work = setup_repos(tmp_path)
    (work / "raw").mkdir()
    (work / "raw" / "a.json").write_text("{}")
    (work / "code.txt").write_text("gestagt, aber nicht vom Scraper")
    git(work, "add", "code.txt")
    assert gitsync.sync(work, "backfill") is True
    files = subprocess.run(["git", "ls-tree", "-r", "--name-only", "main"], cwd=remote, capture_output=True, text=True)
    assert "raw/a.json" in files.stdout
    assert "code.txt" not in files.stdout
