"""SQLite 存取层(标准库 sqlite3,无 ORM 依赖)。"""
import json
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterable

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS repos (
  gh_id        INTEGER PRIMARY KEY,
  full_name    TEXT UNIQUE NOT NULL,
  owner        TEXT NOT NULL,
  owner_type   TEXT,
  avatar_url   TEXT,
  description  TEXT,
  language     TEXT,
  topics       TEXT,
  license      TEXT,
  stars        INTEGER NOT NULL DEFAULT 0,
  forks        INTEGER DEFAULT 0,
  open_issues  INTEGER DEFAULT 0,
  created_at   TEXT,
  pushed_at    TEXT,
  first_seen   TEXT NOT NULL,
  stars_1d     REAL,
  stars_7d     REAL,
  stars_28d    REAL,
  velocity_est INTEGER DEFAULT 1,
  score        REAL DEFAULT 0,
  black_horse  INTEGER DEFAULT 0,
  is_ai        INTEGER DEFAULT 0,
  commentary   TEXT,
  commentary_why TEXT,
  commentary_model TEXT,
  track_id     INTEGER,
  spark        TEXT,
  updated_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_repos_score ON repos(score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos(stars DESC);

CREATE TABLE IF NOT EXISTS snapshots (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  gh_id     INTEGER NOT NULL,
  stars     INTEGER NOT NULL,
  stars_1d  REAL,
  stars_7d  REAL,
  is_est    INTEGER DEFAULT 0,
  taken_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snap ON snapshots(gh_id, taken_at);

CREATE TABLE IF NOT EXISTS tracks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  summary    TEXT,
  size       INTEGER DEFAULT 0,
  heat       REAL DEFAULT 0,
  method     TEXT,
  repo_full_names TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS fetch_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT, finished_at TEXT,
  status     TEXT, note TEXT,
  repos_seen INTEGER DEFAULT 0,
  repos_new  INTEGER DEFAULT 0
);
"""


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(config.DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    return con


@contextmanager
def db():
    con = connect()
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    with db() as con:
        con.executescript(SCHEMA)


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        d = dict(r)
        if "topics" in d and isinstance(d["topics"], str):
            try:
                d["topics"] = json.loads(d["topics"])
            except Exception:
                d["topics"] = []
        if "spark" in d and isinstance(d["spark"], str):
            try:
                d["spark"] = json.loads(d["spark"])
            except Exception:
                d["spark"] = []
        out.append(d)
    return out
