"""每日简报与每周报告:纯数据库聚合,LLM 导语可选。"""
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import ai, db, tracks


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _fmt(n) -> str:
    n = n or 0
    if n >= 10000:
        return f"{n/1000:.1f}k"
    if n >= 1000:
        return f"{n/1000:.2f}k"
    return f"{int(n)}"


def _top_movers(since_iso: str, limit: int = 10) -> list[dict]:
    """期间内真实新增(按快照差)最高的项目。"""
    with db.db() as con:
        rows = con.execute(
            """
            SELECT r.full_name, r.description, r.language, r.stars, r.stars_7d, r.stars_1d,
                   r.commentary, r.is_ai, r.black_horse,
                   MAX(s.stars) - MIN(s.stars) AS gained
            FROM snapshots s JOIN repos r ON r.gh_id = s.gh_id
            WHERE s.taken_at >= ?
            GROUP BY s.gh_id
            HAVING gained > 0
            ORDER BY gained DESC LIMIT ?
            """,
            (since_iso, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def _newcomers(since_iso: str, limit: int = 8) -> list[dict]:
    with db.db() as con:
        rows = con.execute(
            "SELECT full_name, description, language, stars, created_at, commentary FROM repos"
            " WHERE first_seen >= ? ORDER BY stars DESC LIMIT ?",
            (since_iso, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def _cooling(limit: int = 8) -> list[dict]:
    with db.db() as con:
        rows = con.execute(
            "SELECT full_name, description, language, stars, prev_score, stars_7d FROM repos"
            " WHERE cooling=1 ORDER BY COALESCE(prev_score,0) DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def _track_delta(days: float) -> tuple[list[dict], list[dict]]:
    """赛道热度变化:返回 (上升, 下降),按 heat 变化排序。"""
    now = _now()
    cur_cut = _iso(now - timedelta(days=1))
    old_cut = _iso(now - timedelta(days=days))
    with db.db() as con:
        def latest(cut):
            rows = con.execute(
                "SELECT label, heat, size, MAX(taken_at) t FROM track_heat"
                " WHERE taken_at >= ? GROUP BY label ORDER BY t DESC",
                (cut,),
            ).fetchall()
            return {r["label"]: r["heat"] for r in rows}
        cur = latest(cur_cut)
        old = latest(old_cut)
    if not cur:
        return [], []
    old = old or cur
    deltas = [{"label": k, "heat": v, "delta": v - old.get(k, v)}
              for k, v in cur.items() if k in old]
    up = sorted([d for d in deltas if d["delta"] > 0.005],
                key=lambda d: -d["delta"])[:4]
    down = sorted([d for d in deltas if d["delta"] < -0.005],
                  key=lambda d: d["delta"])[:4]
    return up, down


def _stats_line(kind: str, movers: list[dict], newcomers: list[dict], up: list[dict]) -> str:
    if not movers:
        return "观测窗口内暂无明显增长。"
    head = movers[0]
    s = f"{head['full_name']} 以 +{_fmt(head['gained'])} stars 领跑"
    if newcomers:
        s += f";新面孔 {len(newcomers)} 个"
    if up:
        s += ";" + "、".join(d["label"] for d in up[:2]) + " 赛道升温"
    return s + "。"


async def _intro(kind: str, payload: dict) -> Optional[str]:
    if not ai.available():
        return None
    movers = [f"{m['full_name']}(+{_fmt(m['gained'])})" for m in payload["movers"][:8]]
    newcomers = [n["full_name"] for n in payload["newcomers"][:6]]
    up = [d["label"] for d in payload["tracks_up"]]
    down = [d["label"] for d in payload["tracks_down"]]
    prompt = (
        f"写一段{'每日' if kind=='daily' else '每周'} GitHub 趋势导语,60~90 字,中文,"
        "信息密度高,点出最强项目、新面孔和赛道冷暖,不要空话,结尾不要总结陈词。\n"
        f"涨幅领先:{('、'.join(movers)) or '无'}\n"
        f"新面孔:{('、'.join(newcomers)) or '无'}\n"
        f"升温赛道:{('、'.join(up)) or '无'};降温赛道:{('、'.join(down)) or '无'}"
    )
    async with ai._client() as c:
        return await ai._chat(c, prompt, "你是 GitHub 趋势评论员,文风克制、具体。中文输出。")


async def build(kind: str) -> dict:
    """kind: daily | weekly。纯聚合,LLM 导语可选。"""
    days = 1 if kind == "daily" else 7
    since = _iso(_now() - timedelta(days=days))
    movers = _top_movers(since)
    newcomers = _newcomers(since)
    cooling = _cooling()
    up, down = _track_delta(7.0)
    payload = {
        "kind": kind,
        "generated_at": _iso(_now()),
        "window_days": days,
        "movers": movers,
        "newcomers": newcomers,
        "cooling": cooling,
        "tracks_up": up,
        "tracks_down": down,
        "stats_line": _stats_line(kind, movers, newcomers, up),
        "intro": None,
    }
    payload["intro"] = (await _intro(kind, payload)) or payload["stats_line"]
    return payload
