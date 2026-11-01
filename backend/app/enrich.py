"""抓取后的富化管线:排名快照、赛道热度、降温、营销检测、HN 共振、commit 活跃度、Watchlist 检查。"""
import asyncio
import json
import re
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import db, hn, notify

MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]

_BUZZ = re.compile(
    r"(10x|100x|supercharge|revolutionar\w*|ultimate|game.?chang\w*|blazingly|"
    r"next.gen|revolution|颠覆|革命性|超神|炸裂)", re.I,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _board_orders() -> dict[str, str]:
    return {
        "velocity|1d": "COALESCE(stars_1d,0) DESC",
        "velocity|7d": "COALESCE(stars_7d,0) DESC",
        "velocity|28d": "COALESCE(stars_28d,0) DESC",
        "fresh|-": "score DESC",
        "total|-": "stars DESC",
    }


def store_ranks():
    """给每个榜单维度存 top 100 排名快照(排名箭头与降温检测的数据源)。"""
    now = _now_iso()
    with db.db() as con:
        fresh_cut = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        for key, order in _board_orders().items():
            board, window = key.split("|")
            where = ""
            if board == "fresh":
                where = f" WHERE created_at >= '{fresh_cut}'"
            rows = con.execute(
                f"SELECT gh_id FROM repos{where} ORDER BY {order} LIMIT 100"
            ).fetchall()
            for i, r in enumerate(rows, 1):
                con.execute(
                    "INSERT INTO ranks(board, window, gh_id, rank, taken_at)"
                    " VALUES (?,?,?,?,?)"
                    " ON CONFLICT(board, window, gh_id, taken_at)"
                    " DO UPDATE SET rank=excluded.rank",
                    (board, window, r["gh_id"], i, now),
                )


def record_track_heat():
    with db.db() as con:
        for t in con.execute("SELECT label, heat, size FROM tracks").fetchall():
            con.execute(
                "INSERT INTO track_heat(label, heat, size, taken_at) VALUES (?,?,?,?)",
                (t["label"], t["heat"], t["size"], _now_iso()),
            )


def compute_cooling():
    """曾在增速榜前 60、如今近 7 日增长停滞 → 过气。"""
    old_cut = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.db() as con:
        was_hot = {r["gh_id"] for r in con.execute(
            "SELECT DISTINCT gh_id FROM ranks WHERE board='velocity' AND rank<=60 AND taken_at < ?",
            (old_cut,),
        ).fetchall()}
        now_stale = set()
        for r in con.execute("SELECT gh_id, stars_7d FROM repos").fetchall():
            if r["gh_id"] in was_hot and (r["stars_7d"] or 0) < 15:
                now_stale.add(r["gh_id"])
        con.execute("UPDATE repos SET cooling=0 WHERE cooling=1")
        for gh_id in now_stale:
            con.execute("UPDATE repos SET cooling=1 WHERE gh_id=?", (gh_id,))


def marketing_heuristic():
    """无 LLM 的兜底:强营销话术 + 小代码量/堆砌 topics → 标记嫌疑。"""
    with db.db() as con:
        rows = con.execute(
            "SELECT gh_id, description, topics, size FROM repos WHERE marketing_method IS NULL"
        ).fetchall()
        for r in rows:
            hay = (r["description"] or "") + " " + (r["topics"] or "")
            topics_n = len((json.loads(r["topics"] or "[]")))
            hit = bool(_BUZZ.search(hay))
            thin = (r["size"] or 0) > 0 and (r["size"] or 0) < 2000
            flag = 1 if (hit and (thin or topics_n >= 8)) else 0
            con.execute(
                "UPDATE repos SET marketing=?, marketing_method='heuristic' WHERE gh_id=?",
                (flag, r["gh_id"]),
            )


async def update_hn(gh, budget: int = 60):
    """HN 共振检测:取增速头部 + watchlist 项目查 Algolia。"""
    with db.db() as con:
        cand = [dict(r) for r in con.execute(
            "SELECT gh_id, full_name, stars_7d FROM repos ORDER BY score DESC LIMIT ?", (budget,)
        ).fetchall()]
        watch = [dict(r) for r in con.execute(
            "SELECT r.gh_id, r.full_name, r.stars_7d FROM watchlist w"
            " JOIN repos r ON r.gh_id = w.gh_id"
        ).fetchall()]
    seen = set()
    targets = []
    for r in cand + watch:
        if r["gh_id"] not in seen:
            seen.add(r["gh_id"])
            targets.append(r)
    sem = asyncio.Semaphore(6)

    async def one(r):
        async with sem:
            try:
                hit = await hn.lookup(r["full_name"])
            except Exception:
                return  # 网络故障:跳过,保留既有共振状态
            if hit is None:
                con = db.connect()
                try:
                    con.execute(
                        "UPDATE repos SET resonance=0 WHERE gh_id=?", (r["gh_id"],)
                    )
                    con.commit()
                finally:
                    con.close()
                return
            resonant = hn.is_resonant(hit, r["stars_7d"], hit["time"])
            con = db.connect()
            try:
                con.execute(
                    "UPDATE repos SET hn_points=?, hn_comments=?, hn_time=?, resonance=?"
                    " WHERE gh_id=?",
                    (hit["points"], hit["comments"], hit["time"],
                     1 if resonant else 0, r["gh_id"]),
                )
                con.commit()
            finally:
                con.close()

    await asyncio.gather(*(one(r) for r in targets))


async def update_commits(gh, budget: int = 60):
    """近 7 日 commit 数(仅 token 路径)。"""
    if not gh.has_token():
        return
    with db.db() as con:
        cand = [dict(r) for r in con.execute(
            "SELECT gh_id, full_name FROM repos ORDER BY score DESC LIMIT ?", (budget,)
        ).fetchall()]
        watch = [dict(r) for r in con.execute(
            "SELECT r.gh_id, r.full_name FROM watchlist w JOIN repos r ON r.gh_id=w.gh_id"
        ).fetchall()]
    seen, targets = set(), []
    for r in cand + watch:
        if r["gh_id"] not in seen:
            seen.add(r["gh_id"])
            targets.append(r)
    sem = asyncio.Semaphore(6)

    async def one(r):
        async with sem:
            n = await gh.count_commits_since(r["full_name"], 7)
            if n is not None:
                con = db.connect()
                try:
                    con.execute("UPDATE repos SET commits_7d=? WHERE gh_id=?", (n, r["gh_id"]))
                    con.commit()
                finally:
                    con.close()

    await asyncio.gather(*(one(r) for r in targets))


def _fmt(n) -> str:
    n = n or 0
    return f"{n/1000:.1f}k" if n >= 10000 else (f"{n/1000:.2f}k" if n >= 1000 else f"{int(n)}")


def check_watchlist():
    """里程碑突破 + 单日暴增检测 → notify.push。"""
    now = _now_iso()
    with db.db() as con:
        rows = [dict(r) for r in con.execute(
            "SELECT w.*, r.stars, r.stars_1d, r.stars_7d, r.description FROM watchlist w"
            " JOIN repos r ON r.gh_id = w.gh_id"
        ).fetchall()]
    for w in rows:
        stars = w["stars"] or 0
        prev = w["last_milestone"] or 0
        crossed = [m for m in MILESTONES if prev < m <= stars]
        if crossed:
            m = max(crossed)
            notify.push(
                "milestone",
                f"🚀 {w['full_name']} 突破 {m:,} stars",
                f"当前 {stars:,} stars · 近7日 ≈+{_fmt(w['stars_7d'])}",
                full_name=w["full_name"], gh_id=w["gh_id"],
                link=f"https://github.com/{w['full_name']}",
            )
            con = db.connect()
            try:
                con.execute("UPDATE watchlist SET last_milestone=? WHERE gh_id=?", (m, w["gh_id"]))
                con.commit()
            finally:
                con.close()
        # 暴增:日增量 >= max(30, 自身近期中位 4 倍),24h 内不重复报
        s1 = w["stars_1d"] or 0
        last_surge = w["last_surge_at"]
        surge_ok = (not last_surge) or (
            (datetime.now(timezone.utc) - datetime.strptime(
                last_surge, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            ).total_seconds() > 86400
        )
        if s1 >= 30 and surge_ok:
            con = db.connect()
            try:
                vals = [r["stars_1d"] for r in con.execute(
                    "SELECT stars_1d FROM snapshots WHERE gh_id=? AND stars_1d IS NOT NULL"
                    " ORDER BY taken_at DESC LIMIT 10", (w["gh_id"],),
                ).fetchall()]
            finally:
                con.close()
            med = statistics.median(vals) if len(vals) >= 3 else 0
            if s1 >= max(30, med * 4):
                notify.push(
                    "surge",
                    f"⚡ {w['full_name']} 单日 +{_fmt(s1)} stars,增速异常",
                    (w["description"] or "")[:80],
                    full_name=w["full_name"], gh_id=w["gh_id"],
                    link=f"https://github.com/{w['full_name']}",
                )
                con = db.connect()
                try:
                    con.execute("UPDATE watchlist SET last_surge_at=? WHERE gh_id=?", (now, w["gh_id"]))
                    con.commit()
                finally:
                    con.close()


async def post_process(gh):
    """fetcher 主流程结束后调用。"""
    try:
        store_ranks()
        record_track_heat()
        compute_cooling()
        marketing_heuristic()
        await update_hn(gh)
        await update_commits(gh)
        check_watchlist()
    except Exception as e:
        print(f"[enrich] post_process failed: {e}")
    finally:
        await hn.close()
