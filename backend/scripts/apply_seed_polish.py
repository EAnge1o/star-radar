"""种子打磨:写入预置中文点评 + 重算黑马标记。

用法:python scripts/apply_seed_polish.py
说明:点评由构建时的大模型生成并人工校对;运行时配置 ZHIPU_API_KEY 后,
     fetcher 会为没有点评的新项目继续生成,不会覆盖这份种子数据。
"""
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, fetcher  # noqa: E402

SEED = Path(__file__).parent / "seed_commentary.json"
MODEL = "GLM-5.3-Flash (build-time, 人工校对)"


def main():
    data = json.loads(SEED.read_text("utf-8"))
    with db.db() as con:
        n = 0
        for full_name, v in data.items():
            cur = con.execute(
                "SELECT commentary FROM repos WHERE full_name=?", (full_name,)
            ).fetchone()
            if cur is None:
                continue
            con.execute(
                "UPDATE repos SET commentary=?, commentary_why=?, commentary_model=?"
                " WHERE full_name=?",
                (v["point"], v["why"], MODEL, full_name),
            )
            n += 1
    fetcher._mark_black_horses()
    with db.db() as con:
        total = con.execute("SELECT COUNT(*) FROM repos WHERE commentary IS NOT NULL").fetchone()[0]
        horses = con.execute("SELECT COUNT(*) FROM repos WHERE black_horse=1").fetchone()[0]
    print(f"applied {n} seed commentaries; total with commentary: {total}; black horses: {horses}")


if __name__ == "__main__":
    main()
