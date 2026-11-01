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

from . import ai, config, db, enrich, fetcher, notify, reports

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app = FastAPI(title="StarRadar API", version="2.0")
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


# ---------------- 榜单 ----------------

WINDOW_COL = {"1d": "stars_1d", "7d": "stars_7d", "28d": "stars_28d"}


@app.get("/api/board")
def board(
    board: str = Query("velocity", pattern="^(velocity|fresh|total|cooling|sub)$"),
    window: str = Query("7d", pattern="^(1d|7d|28d)$"),
    lang: str = "",
    q: str = "",
    ai_only: bool = False,
    track_id: int = 0,
    sub_id: int = 0,
    fresh_days: int = 30,
    limit: int = 60,
):
    where, args = [], []
    join_sql = ""
    if board == "fresh":
        cut = (datetime.now(timezone.utc) - timedelta(days=fresh_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        where.append("r.created_at >= ?")
        args.append(cut)
    elif board == "cooling":
        where.append("r.cooling = 1")
    elif board == "sub":
        if not sub_id:
            raise HTTPException(400, "sub_id required")
        join_sql = " JOIN sub_results s ON s.gh_id = r.gh_id AND s.sub_id = ?"
        args.append(sub_id)
        where.append(
            "s.taken_at = (SELECT MAX(taken_at) FROM sub_results WHERE sub_id = ?)"
        )
        args.append(sub_id)
    if lang:
        where.append("r.language = ?")
        args.append(lang)
    if track_id:
        where.append("r.track_id = ?")
        args.append(track_id)
    if q:
        where.append("(r.full_name LIKE ? OR r.description LIKE ? OR r.commentary LIKE ? OR r.topics LIKE ?)")
        args.extend([f"%{q}%"] * 4)
    if ai_only:
        where.append("r.is_ai = 1")
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    if board == "total":
        order_sql = "r.stars DESC"
    elif board == "cooling":
        order_sql = "COALESCE(r.prev_score, 0) DESC"
    elif board == "sub":
        order_sql = "s.position ASC"
    elif board == "fresh":
        order_sql = "r.score DESC"
    else:
        order_sql = f"COALESCE(r.{WINDOW_COL.get(window, 'stars_7d')},0) DESC"

    sql = f"SELECT r.* FROM repos r{join_sql}{where_sql} ORDER BY {order_sql} LIMIT ?"
    with db.db() as con:
        rows = db.rows_to_dicts(con.execute(sql, (*args, max(1, min(limit, 200)))).fetchall())
        langs = [r[0] for r in con.execute(
            "SELECT language, COUNT(*) c FROM repos WHERE language IS NOT NULL"
            " GROUP BY language ORDER BY c DESC LIMIT 14"
        )]

        # 排名变化:取该维度上两期排名
        key_board, key_window = (board, window) if board == "velocity" else (
            (board, "-") if board in ("fresh", "total", "cooling") else (board, "-")
        )
        dates = [r[0] for r in con.execute(
            "SELECT DISTINCT taken_at FROM ranks WHERE board=? AND window=?"
            " ORDER BY taken_at DESC LIMIT 2",
            (key_board, key_window),
        ).fetchall()]
        prev_map = {}
        if len(dates) >= 2:
            for r in con.execute(
                "SELECT gh_id, rank FROM ranks WHERE board=? AND window=? AND taken_at=?",
                (key_board, key_window, dates[1]),
            ).fetchall():
                prev_map[r["gh_id"]] = r["rank"]

    # 同一 owner 多项目同榜 → 提示刷榜嫌疑
    owner_count: dict[str, int] = {}
    for r in rows:
        owner_count[r["owner"]] = owner_count.get(r["owner"], 0) + 1
    for r in rows:
        r["prev_rank"] = prev_map.get(r["gh_id"])
        r["owner_hot"] = 1 if owner_count.get(r["owner"], 0) >= 3 else 0

    return {"repos": rows, "languages": langs, "board": board, "window": window}


@app.get("/api/tracks")
def tracks_list():
    with db.db() as con:
        ts = db.rows_to_dicts(con.execute(
            "SELECT * FROM tracks ORDER BY heat DESC"
        ).fetchall())
        for t in ts:
            names = json.loads(t.get("repo_full_names") or "[]")
            with_name = []
            for n in names[:6]:
                r = con.execute(
                    "SELECT full_name, stars, language FROM repos WHERE full_name=?", (n,)
                ).fetchone()
                if r:
                    with_name.append(dict(r))
            t["repos"] = with_name
            del t["repo_full_names"]
    return {"tracks": ts}


@app.get("/api/tracks/view")
def track_view(label: str):
    with db.db() as con:
        t = con.execute("SELECT * FROM tracks WHERE label=?", (label,)).fetchone()
        if not t:
            raise HTTPException(404, "track not found")
        members = db.rows_to_dicts(con.execute(
            "SELECT * FROM repos WHERE track_id=? ORDER BY score DESC LIMIT 60",
            (t["id"],),
        ).fetchall())
        heat_hist = [dict(r) for r in con.execute(
            "SELECT heat, size, taken_at FROM track_heat WHERE label=? ORDER BY taken_at",
            (label,),
        ).fetchall()]
    track = db.rows_to_dicts([t])[0]
    track["heat_history"] = heat_hist
    return {"track": track, "members": members}


# ---------------- 项目详情 ----------------

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
        related = []
        if r["track_id"]:
            related = db.rows_to_dicts(con.execute(
                "SELECT full_name, stars, language, description, commentary, is_ai"
                " FROM repos WHERE track_id=? AND gh_id != ? ORDER BY score DESC LIMIT 6",
                (r["track_id"], r["gh_id"]),
            ).fetchall())

    data = db.rows_to_dicts([r])[0]
    data["snapshots"] = snaps
    data["related"] = related

    # README 摘要(懒加载 + 缓存;无 LLM 时用首段抽取)
    if not data.get("readme_summary"):
        from . import github
        gh = github.GitHubClient()
        try:
            text = gh.get_readme_sync(data["full_name"])
            if text:
                summary = _summarize(data, text)
                with db.db() as con:
                    con.execute(
                        "INSERT INTO readme_cache(gh_id, text, updated_at) VALUES (?,?,?)"
                        " ON CONFLICT(gh_id) DO UPDATE SET text=excluded.text,"
                        " updated_at=excluded.updated_at",
                        (data["gh_id"], text[:6000], data["updated_at"]),
                    )
                    con.execute(
                        "UPDATE repos SET readme_summary=? WHERE gh_id=?",
                        (summary, data["gh_id"]),
                    )
                data["readme_summary"] = summary
        finally:
            pass
    return data


def _summarize(repo: dict, text: str) -> str:
    """无 LLM:抽取 README 首个有信息量的段落;有 LLM:两句话中文摘要。"""
    import re
    if ai.available():
        try:
            import asyncio
            import concurrent.futures

            async def run():
                prompt = (
                    f"用中文两句话(不超过 70 字)概括这个 GitHub 项目是做什么的、有什么特点。\n"
                    f"名称:{repo['full_name']}\n简介:{repo.get('description') or '无'}\n"
                    f"README 开头:\n{text[:1800]}"
                )
                async with ai._client() as c:
                    return await ai._chat(c, prompt, "只输出摘要本身。中文。")
            with concurrent.futures.ThreadPoolExecutor(1) as ex:
                out = ex.submit(asyncio.run, run()).result(timeout=60)
            if out:
                return out.strip()[:200]
        except Exception as e:
            print(f"[readme] llm summary failed: {e}")
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("#", "!", "|", "[!", "<!--", "- [ ]", "Read in", "Translations")):
            continue
        link_n = line.count("](") + line.count("<a ")
        line = re.sub(r"<[^>]+>", " ", line)          # 剥 HTML 标签
        line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)  # 剥 markdown 链接
        line = line.replace("**", "").replace("`", "")
        line = re.sub(r"\s+", " ", line).strip()
        if link_n > 2 or len(line) < 50:               # 徽章行/导航行/太短的行跳过
            continue
        lines.append(line)
        if len(" ".join(lines)) > 200:
            break
    return (" ".join(lines) or (repo.get("description") or ""))[:220]


# ---------------- Watchlist ----------------

@app.get("/api/watch")
def watch_list():
    with db.db() as con:
        rows = db.rows_to_dicts(con.execute(
            "SELECT r.*, w.added_at, w.last_milestone, w.note FROM watchlist w"
            " JOIN repos r ON r.gh_id = w.gh_id ORDER BY w.added_at DESC"
        ).fetchall())
    return {"repos": rows}


@app.post("/api/watch")
async def watch_add(payload: dict):
    full_name = (payload or {}).get("full_name", "").strip()
    with db.db() as con:
        r = con.execute("SELECT gh_id, stars FROM repos WHERE full_name=?", (full_name,)).fetchone()
        if not r:
            raise HTTPException(404, "该项目还不在雷达库中,等下一次观测或用订阅功能覆盖它")
        init_ms = max([m for m in enrich.MILESTONES if m <= r["stars"]], default=0)
        con.execute(
            "INSERT INTO watchlist(gh_id, full_name, added_at, last_milestone)"
            " VALUES (?,?,?,?)"
            " ON CONFLICT(gh_id) DO UPDATE SET last_milestone=excluded.last_milestone",
            (r["gh_id"], full_name, datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), init_ms),
        )
    # 立刻补一次单仓富化(HN / commits),让关注页马上有内容
    from . import github, hn as hn_mod
    gh = github.GitHubClient()
    try:
        hit = await hn_mod.lookup(full_name)
        if hit:
            with db.db() as con:
                con.execute(
                    "UPDATE repos SET hn_points=?, hn_comments=?, hn_time=? WHERE gh_id=?",
                    (hit["points"], hit["comments"], hit["time"], r["gh_id"]),
                )
        if gh.has_token():
            n = await gh.count_commits_since(full_name, 7)
            if n is not None:
                with db.db() as con:
                    con.execute("UPDATE repos SET commits_7d=? WHERE gh_id=?", (n, r["gh_id"]))
    finally:
        await gh.close()
    return {"ok": True, "gh_id": r["gh_id"]}


@app.delete("/api/watch/{gh_id}")
def watch_remove(gh_id: int):
    with db.db() as con:
        con.execute("DELETE FROM watchlist WHERE gh_id=?", (gh_id,))
    return {"ok": True}


# ---------------- 关键词订阅 ----------------

@app.get("/api/subs")
def subs_list():
    with db.db() as con:
        subs = [dict(r) for r in con.execute("SELECT * FROM subscriptions ORDER BY id").fetchall()]
        for s in subs:
            s["results"] = con.execute(
                "SELECT COUNT(*) c FROM sub_results WHERE sub_id=?", (s["id"],)
            ).fetchone()["c"]
    return {"subs": subs}


@app.post("/api/subs")
def subs_add(payload: dict):
    name = ((payload or {}).get("name") or "").strip()[:24]
    query = ((payload or {}).get("query") or "").strip()[:200]
    if not name or not query:
        raise HTTPException(400, "name 和 query 必填")
    with db.db() as con:
        cur = con.execute(
            "INSERT INTO subscriptions(name, query, created_at) VALUES (?,?,?)",
            (name, query, datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
        )
        return {"ok": True, "id": cur.lastrowid}


@app.delete("/api/subs/{sub_id}")
def subs_remove(sub_id: int):
    with db.db() as con:
        con.execute("DELETE FROM subscriptions WHERE id=?", (sub_id,))
        con.execute("DELETE FROM sub_results WHERE sub_id=?", (sub_id,))
    return {"ok": True}


# ---------------- 报告 ----------------

@app.get("/api/report/{kind}")
async def report(kind: str):
    if kind not in ("daily", "weekly"):
        raise HTTPException(404, "kind must be daily|weekly")
    return await reports.build(kind)


@app.post("/api/report/push")
async def report_push(payload: dict):
    kind = (payload or {}).get("kind", "daily")
    if kind not in ("daily", "weekly"):
        raise HTTPException(400, "kind must be daily|weekly")
    payload = await reports.build(kind)
    title = ("📡 StarRadar 每日简报" if kind == "daily" else "📈 StarRadar 每周报告") \
        + " · " + payload["stats_line"][:60]
    res = notify.push("report", title, "打开 StarRadar 查看完整报告",
                      link="http://127.0.0.1:8000/#/report/" + kind)
    return {"ok": True, "delivered": res}


# ---------------- 通知与设置 ----------------

@app.get("/api/notifications")
def notifications(since: int = 0):
    return {"notifications": notify.recent(since)}


@app.post("/api/notifications/test")
def notifications_test():
    res = notify.push("test", "🔔 StarRadar 测试通知",
                      "如果你在飞书/Telegram 收到这条,推送通道已经打通。")
    return {"ok": True, "result": res}


@app.get("/api/settings")
def settings_get():
    cfg = notify.config()
    masked = {}
    for k, v in cfg.items():
        if not v:
            masked[k] = ""
        elif k == "telegram_token":
            masked[k] = "••••" + v[-4:] if len(v) > 6 else "••••"
        else:
            masked[k] = v[:34] + ("…" if len(v) > 34 else "")
    return {"settings": masked}


@app.post("/api/settings")
def settings_set(payload: dict):
    data = payload or {}
    for k, v in data.items():
        if k in notify.CONFIG_KEYS:
            notify.set_setting(k, (v or "").strip() or None)
    return {"ok": True, "settings": settings_get()["settings"]}


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
        resonant = one("SELECT COUNT(*) FROM repos WHERE resonance=1")
        watch_n = one("SELECT COUNT(*) FROM watchlist")
        subs_n = one("SELECT COUNT(*) FROM subscriptions")
        track_n = one("SELECT COUNT(*) FROM tracks")
        last_run = con.execute(
            "SELECT * FROM fetch_runs WHERE status='ok' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return {
        "total_repos": total,
        "today_new_stars": round(today_stars),
        "newcomers": newcomers,
        "black_horses": horses,
        "resonant": resonant,
        "watch_count": watch_n,
        "subs_count": subs_n,
        "tracks": track_n,
        "last_fetch": dict(last_run) if last_run else None,
        "llm_ready": ai.available(),
        "llm_model": config.LLM_MODEL if ai.available() else None,
        "github_token": bool(config.GITHUB_TOKEN),
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
    app.mount("/icons", StaticFiles(directory=FRONTEND_DIST), name="icons")

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
