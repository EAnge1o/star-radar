"""Hacker News(Algolia)联动:检测项目是否也在 HN 上起量 —— 双平台共振。"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

HN_API = "https://hn.algolia.com/api/v1/search"
_client: Optional[httpx.AsyncClient] = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(15))
    return _client


async def close():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()


async def lookup(full_name: str) -> Optional[dict]:
    """查仓库在 HN 上的最佳故事(30 天内优先,分高者优先)。

    返回 {points, comments, time};无相关帖子返回 None;网络异常向上抛,
    由调用方决定跳过,避免把临时故障当成"没有 HN 热度"。
    """
    c = await _get_client()
    r = await c.get(HN_API, params={
        "query": f"github.com/{full_name}",
        "tags": "story",
        "hitsPerPage": "8",
    })
    if r.status_code != 200:
        return None
    hits = r.json().get("hits", [])
    if not hits:
        return None
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    recent = [h for h in hits if (h.get("created_at") or "") >= cutoff]
    pool = recent or hits
    best = max(pool, key=lambda h: (h.get("points") or 0))
    points = best.get("points") or 0
    if points < 5:
        return None
    return {
        "points": int(points),
        "comments": int(best.get("num_comments") or 0),
        "time": best.get("created_at"),
    }


def is_resonant(hn: Optional[dict], stars_7d: float, hn_time: Optional[str]) -> bool:
    """共振 = HN 有近期(7 天内)帖子且热度达标,同时 GitHub 侧确实在涨。"""
    if not hn or not hn_time:
        return False
    try:
        t = datetime.strptime(hn_time[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        return False
    if datetime.now(timezone.utc) - t > timedelta(days=7):
        return False
    return hn["points"] >= 10 and (stars_7d or 0) >= 30
