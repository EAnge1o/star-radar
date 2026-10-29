"""StarRadar 服务:API + 定时抓取 + 前端静态托管。"""
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import ai, config, db, fetcher

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app = FastAPI(title="StarRadar API", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_fetch_lock = asyncio.Lock()
_scheduler_task: Optional[asyncio.Task] = None


@app.on_event("startup")
async def startup():
    db.init_db()
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_scheduler_loop())


@app.on_event("shutdown")
async def shutdown():
    if _scheduler_task:
        _scheduler_task.cancel()


async def _scheduler_loop():
    """启动时检查数据新鲜度;之后每 30 分钟巡检一次,超过间隔自动抓取。"""
    from . import github

    await asyncio.sleep(3)
    if config.AUTO_FETCH_ON_BOOT:
        try:
            await _fetch_if_stale()
        except Exception as e:
            print(f"[scheduler] boot fetch failed: {e}")
    while True:
        await asyncio.sleep(1800)
        try:
            await _fetch_if_stale()
        except Exception as e:
            print(f"[scheduler] fetch failed: {e}")


async def _fetch_if_stale():
    with db.db() as con:
        row = con.execute(
            "SELECT MAX(finished_at) AS t FROM fetch_runs WHERE status='ok'"
        ).fetchone()
    stale = True
    if row and row["t"]:
        try:
            last = datetime.strptime(row["t"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            stale = (datetime.now(timezone.utc) - last).total_seconds() > config.FETCH_INTERVAL_HOURS * 3600
        except Exception:
            stale = True
    if stale:
        await do_fetch()


async def do_fetch():
    async with _fetch_lock:
        return await fetcher.run_fetch()


# ---------------- API ----------------

LANG_WHITELIST = {"1d": "stars_1d", "7d": "stars_7d", "28d": "stars_28d"}


@app.get("/api/board")
def board(
    board: str = Query("velocity", pattern="^(velocity|fresh|total)$"),
    window: str = Query("7d", pattern="^(1d|7d|28d)$"),
    lang: str = "",
    q: str = "",
    ai_only: bool = False,
    track_id: int = 0,
    fresh_days: int = 30,
    limit: int = 60,
):
    order_col = LANG_WHITELIST.get(window, "stars_7d")
    where, args = [], []
    if board == "fresh":
        cut = (datetime.now(timezone.utc) - timedelta(days=fresh_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        where.append("created_at >= ?")
        args.append(cut)
    if lang:
        where.append("language = ?")
        args.append(lang)
    if track_id:
        where.append("track_id = ?")
        args.append(track_id)
    if q:
        where.append("(full_name LIKE ? OR description LIKE ? OR commentary LIKE ? OR topics LIKE ?)")
        args.extend([f"%{q}%"] * 4)
    if ai_only:
        where.append("is_ai = 1")
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    if board == "total":
        order_sql = "stars DESC"
    elif board == "fresh":
        order_sql = "score DESC"
    else:
        order_sql = f"COALESCE({order_col},0) DESC"

    sql = f"SELECT * FROM repos{where_sql} ORDER BY {order_sql} LIMIT ?"
    with db.db() as con:
        rows = db.rows_to_dicts(con.execute(sql, (*args, max(1, min(limit, 200)))).fetchall())
        langs = [r[0] for r in con.execute(
            "SELECT language, COUNT(*) c FROM repos WHERE language IS NOT NULL"
            " GROUP BY language ORDER BY c DESC LIMIT 14"
        )]
    return {"repos": rows, "languages": langs, "board": board, "window": window}


@app.get("/api/tracks")
def tracks_list():
    with db.db() as con:
        ts = db.rows_to_dicts(con.execute(
            "SELECT * FROM tracks ORDER BY heat DESC"
        ).fetchall())
        for t in ts:
            t["repo_full_names"] = json.loads(t.get("repo_full_names") or "[]")
            with_name = []
            for n in t["repo_full_names"][:6]:
                r = con.execute(
                    "SELECT full_name, stars, language FROM repos WHERE full_name=?",
                    (n,),
                ).fetchone()
                if r:
                    with_name.append(dict(r))
            t["repos"] = with_name
            del t["repo_full_names"]
    return {"tracks": ts}


@app.get("/api/repos/{full_name:path}")
def repo_detail(full_name: str):
    with db.db() as con:
        r = con.execute("SELECT * FROM repos WHERE full_name=?", (full_name,)).fetchone()
        if not r:
            raise HTTPException(404, "repo not found")
        snaps = db.rows_to_dicts(con.execute(
            "SELECT stars, taken_at FROM snapshots WHERE gh_id=? ORDER BY taken_at",
            (r["gh_id"],),
        ).fetchall())
    data = db.rows_to_dicts([r])[0]
    data["snapshots"] = snaps
    return data


@app.get("/api/stats")
def stats():
    with db.db() as con:
        def one(sql, args=()):
            return con.execute(sql, args).fetchone()[0]
        total = one("SELECT COUNT(*) FROM repos")
        today_stars = one("SELECT COALESCE(SUM(stars_1d),0) FROM repos")
        newcomers = one(
            "SELECT COUNT(*) FROM repos WHERE created_at >= ?",
            ((datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),),
        )
        horses = one("SELECT COUNT(*) FROM repos WHERE black_horse=1")
        track_n = one("SELECT COUNT(*) FROM tracks")
        last_run = con.execute(
            "SELECT * FROM fetch_runs WHERE status='ok' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        llm = ai.available()
        from . import github
        has_token = bool(config.GITHUB_TOKEN)
    return {
        "total_repos": total,
        "today_new_stars": round(today_stars),
        "newcomers": newcomers,
        "black_horses": horses,
        "tracks": track_n,
        "last_fetch": dict(last_run) if last_run else None,
        "llm_ready": llm,
        "llm_model": config.LLM_MODEL if llm else None,
        "github_token": has_token,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/refresh")
async def refresh():
    try:
        result = await do_fetch()
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(500, str(e)[:300])


@app.post("/api/llm/enable")
async def llm_enable(payload: dict):
    """运行时注入 API key(不落盘),便于前端设置面板使用。"""
    key = (payload or {}).get("key", "").strip()
    if not key:
        raise HTTPException(400, "key required")
    config.ZHIPU_API_KEY = key
    return {"ok": True, "probe": await ai.probe()}


@app.post("/api/llm/comment")
async def llm_comment():
    if not ai.available():
        raise HTTPException(400, "LLM not configured")
    result = await fetcher.run_fetch(with_commentary=True, with_tracks=False)
    return {"ok": True, "commentary": result["commentary"]}


@app.post("/api/llm/tracks")
async def llm_tracks():
    if not ai.available():
        raise HTTPException(400, "LLM not configured")
    with db.db() as con:
        repos = db.rows_to_dicts(con.execute(
            "SELECT full_name, description, topics, language FROM repos LIMIT 400"
        ).fetchall())
    clusters, method = fetcher.rebuild_tracks(repos)
    return {"ok": True, "method": method, "tracks": len(clusters)}


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------------- 静态托管 ----------------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")


def main():
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")


if __name__ == "__main__":
    main()
