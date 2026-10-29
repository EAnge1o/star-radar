"""手动抓取一次:python scripts/fetch_once.py [--no-commentary] [--no-tracks]"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, fetcher  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-commentary", action="store_true")
    ap.add_argument("--no-tracks", action="store_true")
    args = ap.parse_args()

    db.init_db()
    result = asyncio.run(fetcher.run_fetch(
        with_commentary=not args.no_commentary,
        with_tracks=not args.no_tracks,
    ))
    print("RESULT:", result)


if __name__ == "__main__":
    main()
