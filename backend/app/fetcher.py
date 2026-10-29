"""抓取编排:搜索候选 → 增速测量/估算 → 快照 → 黑马 → 点评 → 赛道。"""
import asyncio
import json
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import ai, config, db, github, tracks

AI_KEYWORDS = [
    "llm", "agent", "ai", "gpt", "rag", "mcp", "transformer", "diffusion",
    "multimodal", "tts", "asr", "embedding", "copilot", "inference", "sft",
    "rlhf", "vlm", "agentic", "chatbot", "prompt", "genai", "deep learning",
    "machine learning", "neural", "大模型", "智能体",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def is_ai_repo(topics: list[str], description: str, language: str) -> bool:
    hay = (" ".join(topics) + " " + (description or "") + " " + (language or "")).lower()
    return any(k in hay for k in AI_KEYWORDS)


def search_queries() -> list[dict]:
    """动态日期构造搜索查询组。"""
    now = _utcnow()
    d = lambda days: (now - timedelta(days=days)).strftime("%Y-%m-%d")
    return [
        {"name": "new_14d", "q": f"created:>={d(14)} stars:>=40", "pages": 2},
        {"name": "new_45d", "q": f"created:>={d(45)} stars:>=300", "pages": 1},
        {"name": "new_45d_ai", "q": f"created:>={d(45)} stars:>=100 topic:llm", "pages": 1},
        {"name": "elite", "q": f"stars:>=5000 pushed:>={d(10)}", "pages": 1},
        {"name": "py", "q": f"language:Python created:>={d(90)} stars:>=150", "pages": 1},
        {"name": "ts", "q": f"language:TypeScript created:>={d(90)} stars:>=150", "pages": 1},
        {"name": "rust", "q": f"language:Rust created:>={d(90)} stars:>=80", "pages": 1},
        {"name": "go", "q": f"language:Go created:>={d(90)} stars:>=120", "pages": 1},
        {"name": "zig_cpp", "q": f"language:Zig stars:>=50 created:>={d(180)}", "pages": 1},
    ]


def parse_repo(item: dict) -> dict:
    owner = item.get("owner") or {}
    lic = (item.get("license") or {}).get("spdx_id")
    return {
        "gh_id": item["id"],
        "full_name": item["full_name"],
        "owner": item["full_name"].split("/")[0],
        "owner_type": owner.get("type"),
        "avatar_url": owner.get("avatar_url"),
        "description": item.get("description"),
        "language": item.get("language"),
        "topics": json.dumps(item.get("topics") or [], ensure_ascii=False),
        "license": lic if lic and lic != "NOASSERTION" else None,
        "stars": item.get("stargazers_count") or 0,
        "forks": item.get("forks_count") or 0,
        "open_issues": item.get("open_issues_count") or 0,
        "created_at": item.get("created_at"),
        "pushed_at": item.get("pushed_at"),
    }


def age_days(created_iso: str) -> float:
    try:
        c = datetime.strptime(created_iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return max((_utcnow() - c).total_seconds() / 86400, 0.5)
    except Exception:
        return 365.0


def est_velocity(stars: int, age: float) -> tuple[float, float, float]:
    """无 token 时的增速估算:日均 = stars/age,按窗口截断到总量。"""
    per_day = stars / max(age, 1)
    return (
        min(per_day, stars),
        min(per_day * 7, stars),
        min(per_day * 28, stars),
    )


def measured_velocity(ts: list[str]) -> tuple[float, float, float, list[tuple[str, int]]]:
    """用最近至多 100 条 starred_at 精确测量增速。

    返回 (1d, 7d, 28d, spark);spark 为 [(iso, 累计序号)] 最近的星标节奏。
    """
    now = _utcnow()
    times = sorted(
        datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        for t in ts
    )
    def count_since(days: float) -> float:
        cut = now - timedelta(days=days)
        n = sum(1 for t in times if t >= cut)
        # 样本窗口早于该窗口起点 → 窗口内星标不止样本数,按样本密度外推
        if times and times[0] > cut:
            span_days = max((now - times[0]).total_seconds() / 86400, 0.5)
            return len(times) * (days / span_days) if span_days > days else n
        return float(n)
    spark = [(t.strftime("%Y-%m-%dT%H:%M:%SZ"), i + 1) for i, t in enumerate(times)]
    return count_since(1), count_since(7), count_since(28), spark


async def run_fetch(*, with_commentary: bool = True, with_tracks: bool = True) -> dict:
    gh = github.GitHubClient()
    started = _iso(_utcnow())
    try:
        return await _run(gh, started, with_commentary, with_tracks)
    except Exception as e:
        with db.db() as con:
            con.execute(
                "INSERT INTO fetch_runs(started_at, finished_at, status, note) VALUES (?,?,?,?)",
                (started, _iso(_utcnow()), "error", str(e)[:300]),
            )
        raise
    finally:
        await gh.close()


async def _run(gh: github.GitHubClient, started: str,
               with_commentary: bool, with_tracks: bool) -> dict:
    print(f"[fetch] start (token={'yes' if gh.has_token() else 'no'})")
    seen: dict[int, dict] = {}
    for spec in search_queries():
        try:
            items = await gh.search_repos(spec["q"], pages=spec["pages"])
        except Exception as e:
            print(f"[fetch] query {spec['name']} failed: {e}")
            items = []
        for it in items:
            seen[it["id"]] = parse_repo(it)
    print(f"[fetch] {len(seen)} candidate repos")

    existing = {}
    with db.db() as con:
        for r in con.execute("SELECT gh_id, first_seen, stars FROM repos"):
            existing[r["gh_id"]] = dict(r)
        new_count = sum(1 for gid in seen if gid not in existing)
        con.execute(
            "INSERT INTO fetch_runs(started_at, status) VALUES (?, 'running')",
            (started,),
        )
        run_id = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]

    # ---------- 增速:token 采样优先,快照差值次之,估算兜底 ----------
    candidates = sorted(seen.values(), key=lambda r: -r["stars"])
    sample_list = candidates[: config.VELOCITY_SAMPLE_BUDGET]
    sampled: dict[int, list[str]] = {}
    if gh.has_token():
        sem = asyncio.Semaphore(6)

        async def one(r: dict):
            async with sem:
                try:
                    ts = await gh.sample_recent_stars(r["full_name"], r["stars"])
                    if ts:
                        sampled[r["gh_id"]] = ts
                except Exception:
                    pass

        await asyncio.gather(*(one(r) for r in sample_list))
        print(f"[fetch] sampled star timestamps for {len(sampled)} repos")

    # 历史快照 → 真实窗口增量(9 天内)
    snap_hist: dict[int, list[dict]] = {}
    with db.db() as con:
        for r in con.execute(
            "SELECT gh_id, stars, taken_at FROM snapshots WHERE taken_at >= ?",
            ((_utcnow() - timedelta(days=9)).strftime("%Y-%m-%d"),),
        ):
            snap_hist.setdefault(r["gh_id"], []).append(dict(r))

    def delta_from_snapshots(hs: list[dict], stars: int, window_days: float):
        """找最接近 window_days 天前的快照求差;找不到返回 None。"""
        now = _utcnow()
        best = None
        best_err = 10**9
        for s in hs:
            try:
                age = (now - datetime.strptime(
                    s["taken_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                ).total_seconds() / 86400
            except Exception:
                continue
            err = abs(age - window_days)
            if err < best_err and age >= window_days - 1.2:
                best, best_err = s, err
        if best is None:
            return None
        return max(stars - best["stars"], 0.0)

    upserted: list[dict] = []
    with db.db() as con:
        for r in candidates:
            gh_id = r["gh_id"]
            age = age_days(r["created_at"]) if r["created_at"] else 365.0
            stars = r["stars"]
            est = 1
            spark = None

            hs = snap_hist.get(gh_id) or []
            d1 = delta_from_snapshots(hs, stars, 1.0) if hs else None
            d7 = delta_from_snapshots(hs, stars, 7.0) if hs else None
            if gh_id in sampled:
                m1, m7, m28, spark = measured_velocity(sampled[gh_id])
                if d1 is None:
                    d1 = m1
                if d7 is None:
                    d7 = m7
            if d1 is None or d7 is None:
                e1, e7, _e28 = est_velocity(stars, age)
                d1 = d1 if d1 is not None else e1
                d7 = d7 if d7 is not None else e7
            # 有采样数据,或两个窗口都有快照实测 → 视为实测
            est = 0 if (gh_id in sampled or
                        (d1 is not None and d7 is not None and
                         delta_from_snapshots(hs, stars, 1.0) is not None and
                         delta_from_snapshots(hs, stars, 7.0) is not None)) else 1
            s1, s7 = d1, d7
            s28 = m28 if gh_id in sampled else min(stars, s7 * 4)

            topics = json.loads(r["topics"])
            is_ai = 1 if is_ai_repo(topics, r["description"] or "", r["language"] or "") else 0
            # 评分:近7日增量为主,增速持续性加成
            score = (s7 or 0) * 1.0 + (s1 or 0) * 2.0 + (3 if is_ai else 0)

            con.execute(
                """
                INSERT INTO repos(gh_id, full_name, owner, owner_type, avatar_url,
                    description, language, topics, license, stars, forks, open_issues,
                    created_at, pushed_at, first_seen, stars_1d, stars_7d, stars_28d,
                    velocity_est, score, is_ai, spark, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(gh_id) DO UPDATE SET
                    full_name=excluded.full_name, owner=excluded.owner,
                    owner_type=excluded.owner_type, avatar_url=excluded.avatar_url,
                    description=excluded.description, language=excluded.language,
                    topics=excluded.topics, license=excluded.license, stars=excluded.stars,
                    forks=excluded.forks, open_issues=excluded.open_issues,
                    created_at=excluded.created_at, pushed_at=excluded.pushed_at,
                    stars_1d=excluded.stars_1d, stars_7d=excluded.stars_7d,
                    stars_28d=excluded.stars_28d, velocity_est=excluded.velocity_est,
                    score=excluded.score, is_ai=excluded.is_ai, updated_at=excluded.updated_at,
                    spark=COALESCE(excluded.spark, repos.spark)
                """,
                (gh_id, r["full_name"], r["owner"], r["owner_type"], r["avatar_url"],
                 r["description"], r["language"], r["topics"], r["license"], stars,
                 r["forks"], r["open_issues"], r["created_at"], r["pushed_at"],
                 existing.get(gh_id, {}).get("first_seen", started),
                 s1, s7, s28, est, score, is_ai,
                 json.dumps(spark, ensure_ascii=False) if spark else None,
                 started),
            )
            con.execute(
                "INSERT INTO snapshots(gh_id, stars, stars_1d, stars_7d, is_est, taken_at)"
                " VALUES (?,?,?,?,?,?)",
                (gh_id, stars, round(s1, 1), round(s7, 1), est, started),
            )
            upserted.append({
                "gh_id": gh_id, "full_name": r["full_name"], "stars": stars,
                "language": r["language"], "topics": topics,
                "description": r["description"], "age_days": round(age),
                "stars_7d": round(s7, 1), "is_ai": is_ai,
            })

    # ---------- 黑马:增速相对同语言基线 ----------
    _mark_black_horses()

    # ---------- LLM 点评 ----------
    commentary_done = 0
    if with_commentary and ai.available():
        with db.db() as con:
            rows = [dict(r) for r in con.execute(
                "SELECT * FROM repos WHERE commentary IS NULL ORDER BY score DESC LIMIT 120"
            )]
        for i in range(0, len(rows), 8):
            batch = rows[i:i + 8]
            got = await ai.comment_repos(batch)
            with db.db() as con:
                for fn, v in got.items():
                    con.execute(
                        "UPDATE repos SET commentary=?, commentary_why=?, commentary_model=?"
                        " WHERE full_name=?",
                        (v["point"], v.get("why", ""), config.LLM_MODEL, fn),
                    )
                    commentary_done += 1
        print(f"[fetch] commentary generated for {commentary_done} repos")

    # ---------- 赛道 ----------
    track_method = None
    if with_tracks:
        try:
            _clusters, track_method = rebuild_tracks(upserted)
        except Exception as e:
            print(f"[fetch] tracks failed: {e}")

    with db.db() as con:
        con.execute(
            "UPDATE fetch_runs SET finished_at=?, status='ok', repos_seen=?, repos_new=?, note=?"
            " WHERE id=?",
            (_iso(_utcnow()), len(candidates), new_count, f"tracks={track_method}", run_id),
        )
    print(f"[fetch] done: {len(candidates)} repos, {new_count} new")
    return {"repos": len(candidates), "new": new_count, "tracks": track_method,
            "commentary": commentary_done}


def rebuild_tracks(repos: list[dict]) -> tuple[list[dict], str]:
    """用给定仓库集合重建赛道表(语义聚类优先,词典退化),并回写 track_id。"""
    clusters, method = tracks.cluster_repos(repos)
    stars7_map: dict[str, float] = {}
    with db.db() as con:
        for r in con.execute("SELECT full_name, stars_7d FROM repos"):
            stars7_map[r["full_name"]] = r["stars_7d"] or 0
    total7 = sum(stars7_map.values()) or 1.0
    with db.db() as con:
        con.execute("DELETE FROM tracks")
        con.execute("UPDATE repos SET track_id=NULL")
        for cl in clusters:
            heat = tracks.heat_score(cl["names"], stars7_map, total7)
            con.execute(
                "INSERT INTO tracks(label, summary, size, heat, method,"
                " repo_full_names, updated_at) VALUES (?,?,?,?,?,?,?)",
                (cl["label"], cl["summary"], len(cl["names"]), heat, method,
                 json.dumps(cl["names"], ensure_ascii=False), _iso(_utcnow())),
            )
            tid = con.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
            con.executemany(
                "UPDATE repos SET track_id=? WHERE full_name=?",
                [(tid, n) for n in cl["names"]],
            )
    return clusters, method


def _mark_black_horses():
    """黑马 = 日增速 > 3× 同语言中位基线;最多标记 8 个,防止通胀。"""
    with db.db() as con:
        rows = [dict(r) for r in con.execute(
            "SELECT gh_id, language, stars_1d, stars_7d FROM repos"
        )]
        by_lang: dict[str, list[float]] = {}
        for r in rows:
            if r["stars_1d"] and r["stars_1d"] > 0:
                by_lang.setdefault(r["language"] or "其他", []).append(r["stars_1d"])
        medians = {k: statistics.median(v) for k, v in by_lang.items() if len(v) >= 5}
        scored = []
        for r in rows:
            m = medians.get(r["language"] or "其他")
            if m and r["stars_1d"] and r["stars_7d"] and r["stars_7d"] >= 50:
                ratio = r["stars_1d"] / max(m, 0.1)
                if ratio > 3:
                    scored.append((ratio, r["gh_id"]))
        scored.sort(reverse=True)
        keep = [gh for _ratio, gh in scored[:8]]
        con.execute("UPDATE repos SET black_horse=0")
        for gh in keep:
            con.execute("UPDATE repos SET black_horse=1 WHERE gh_id=?", (gh,))
