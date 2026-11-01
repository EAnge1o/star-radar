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
  prev_score   REAL,
  black_horse  INTEGER DEFAULT 0,
  is_ai        INTEGER DEFAULT 0,
  size         INTEGER,
  commits_7d   INTEGER,
  hn_points    INTEGER,
  hn_comments  INTEGER,
  hn_time      TEXT,
  resonance    INTEGER DEFAULT 0,
  cooling      INTEGER DEFAULT 0,
  marketing    INTEGER DEFAULT 0,
  marketing_method TEXT,
  readme_summary   TEXT,
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

CREATE TABLE IF NOT EXISTS watchlist (
  gh_id          INTEGER PRIMARY KEY,
  full_name      TEXT UNIQUE NOT NULL,
  note           TEXT,
  added_at       TEXT NOT NULL,
  last_milestone REAL,
  last_surge_at  TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  query      TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_results (
  sub_id   INTEGER NOT NULL,
  gh_id    INTEGER NOT NULL,
  position INTEGER NOT NULL,
  taken_at TEXT NOT NULL,
  PRIMARY KEY (sub_id, gh_id)
);

CREATE TABLE IF NOT EXISTS ranks (
  board    TEXT NOT NULL,
  window   TEXT NOT NULL,
  gh_id    INTEGER NOT NULL,
  rank     INTEGER NOT NULL,
  taken_at TEXT NOT NULL,
  PRIMARY KEY (board, window, gh_id, taken_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  gh_id      INTEGER,
  full_name  TEXT,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  link       TEXT,
  channel    TEXT,
  delivered  INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS track_heat (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  label    TEXT NOT NULL,
  heat     REAL NOT NULL,
  size     INTEGER NOT NULL,
  taken_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readme_cache (
  gh_id      INTEGER PRIMARY KEY,
  text       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
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
        _migrate(con)


# 已有库升级:缺的列用 ALTER 补上(幂等)
_NEW_REPO_COLUMNS = [
    ("prev_score", "REAL"),
    ("size", "INTEGER"),
    ("commits_7d", "INTEGER"),
    ("hn_points", "INTEGER"),
    ("hn_comments", "INTEGER"),
    ("hn_time", "TEXT"),
    ("resonance", "INTEGER DEFAULT 0"),
    ("cooling", "INTEGER DEFAULT 0"),
    ("marketing", "INTEGER DEFAULT 0"),
    ("marketing_method", "TEXT"),
    ("readme_summary", "TEXT"),
]


def _migrate(con: sqlite3.Connection):
    existing = {r["name"] for r in con.execute("PRAGMA table_info(repos)")}
    for col, typ in _NEW_REPO_COLUMNS:
        if col not in existing:
            con.execute(f"ALTER TABLE repos ADD COLUMN {col} {typ}")


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
