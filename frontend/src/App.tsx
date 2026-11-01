import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert } from "lucide-react";
import { api, type BoardQuery } from "./api";
import type { BoardResp, Repo, Stats, Sub, Track } from "./types";
import { timeAgo } from "./utils";
import { navigate, syncBoardQuery, useHashRoute } from "./useHashRoute";
import Controls, { type BoardKind, type WindowKind } from "./components/Controls";
import Hero from "./components/Hero";
import RepoDetail from "./components/RepoDetail";
import RepoRow from "./components/RepoRow";
import ReportPage from "./components/ReportPage";
import SettingsModal from "./components/SettingsModal";
import SubsModal from "./components/SubsModal";
import TopNav from "./components/TopNav";
import TrackPage from "./components/TrackPage";
import TrackStrip from "./components/TrackStrip";
import WatchlistPage from "./components/WatchlistPage";

const BOARD_TITLES: Record<string, string> = {
  velocity: "增速榜 · 谁在真金白银地涨",
  fresh: "新秀榜 · 近 30 天出生的爆发项目",
  total: "总量榜 · 已成气候的巨头",
  cooling: "降温榜 · 曾上榜,如今停滞",
};

type Theme = "dark" | "light";
type Density = "cozy" | "compact";

export default function App() {
  const route = useHashRoute();

  const [board, setBoard] = useState<BoardKind>((route.query.get("board") as BoardKind) || "velocity");
  const [win, setWin] = useState<WindowKind>((route.query.get("window") as WindowKind) || "7d");
  const [lang, setLang] = useState(route.query.get("lang") || "");
  const [q, setQ] = useState(route.query.get("q") || "");
  const [qDebounced, setQDebounced] = useState(route.query.get("q") || "");
  const [aiOnly, setAiOnly] = useState(route.query.get("ai") === "1");
  const [trackId, setTrackId] = useState(Number(route.query.get("track") || 0));
  const [subId, setSubId] = useState(Number(route.query.get("sub") || 0));

  const [data, setData] = useState<BoardResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Repo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("sr-theme") as Theme) || "dark");
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem("sr-density") as Density) || "cozy");
  const [cursor, setCursor] = useState(-1);
  const lastNotifId = useRef(0);
  const toastTimer = useRef(0);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  // 主题 / 密度
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    localStorage.setItem("sr-theme", theme);
    localStorage.setItem("sr-density", density);
  }, [theme, density]);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  // 榜单状态 → URL(可分享)
  useEffect(() => {
    if (route.path === "") {
      syncBoardQuery({
        board: board === "velocity" ? "" : board,
        window: board === "velocity" && win !== "7d" ? win : "",
        lang, q: qDebounced, ai: aiOnly, track: trackId, sub: subId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, win, lang, qDebounced, aiOnly, trackId, subId, route.path]);

  const query: BoardQuery = {
    board, window: win, lang, q: qDebounced, ai_only: aiOnly,
    track_id: trackId, sub_id: subId, limit: 60,
  };

  const loadBoard = useCallback(() => {
    setLoading(true);
    api.board(query)
      .then((d) => { setData(d); setLoadError(false); })
      .catch(() => { setLoadError(true); notify("榜单加载失败,请确认后端已启动"); })
      .finally(() => { setLoading(false); setCursor(-1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, win, lang, qDebounced, aiOnly, trackId, subId]);

  const loadMeta = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.tracks().then((r) => setTracks(r.tracks)).catch(() => {});
    api.subs.list().then((r) => setSubs(r.subs)).catch(() => {});
    api.watch.list().then((r) => setWatched(new Set(r.repos.map((x) => x.gh_id)))).catch(() => {});
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // 通知轮询:站内 toast + 桌面通知
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await api.notifications(lastNotifId.current);
        for (const n of r.notifications) {
          if (n.id > lastNotifId.current) lastNotifId.current = n.id;
          if (n.kind === "test") continue;
          notify(n.title);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("StarRadar", { body: n.title + (n.message ? `\n${n.message}` : "") });
          }
        }
      } catch { /* 服务未启动时静默 */ }
    };
    poll();
    const t = setInterval(poll, 60000);
    return () => clearInterval(t);
  }, [notify]);

  const refresh = async () => {
    setRefreshing(true);
    notify("雷达正在扫描 GitHub(含 HN 共振检测),约需 1-2 分钟…");
    try {
      const r = await api.refresh();
      notify(`观测完成:${r.repos} 个项目在册,新增 ${r.new} 个`);
      loadBoard();
      loadMeta();
    } catch (e) {
      notify(`观测失败:${String(e).slice(0, 90)}`);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleWatch = async (r: Repo) => {
    if (watched.has(r.gh_id)) {
      await api.watch.remove(r.gh_id);
      notify(`已取消关注 ${r.full_name}`);
    } else {
      try {
        await api.watch.add(r.full_name);
        notify(`已关注 ${r.full_name}:破里程碑或单日暴增时会推送`);
      } catch (e) {
        notify(String(e).slice(0, 90));
      }
    }
    api.watch.list().then((x) => setWatched(new Set(x.repos.map((y) => y.gh_id)))).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  };

  // 键盘导航:j/k 移动,Enter 开详情,/ 聚焦搜索
  const rows = data?.repos ?? [];
  const sparkMax = rows.length
    ? Math.max(1, ...rows.flatMap((r) => (r.spark ?? []).map(([, v]) => v)))
    : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (route.path !== "" || detail) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("board-search")?.focus();
      } else if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "j" ? Math.min(c + 1, rows.length - 1) : Math.max(c - 1, 0);
          document.querySelector(".row-cursor")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "Enter") {
        if (cursor >= 0 && rows[cursor]) setDetail(rows[cursor]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, route.path, detail]);

  // 路由:非榜单页
  if (route.path.startsWith("track/")) {
    const label = decodeURIComponent(route.path.slice("track/".length));
    return (
      <>
        <TopNav
          lastFetchAt={stats?.last_fetch?.finished_at ?? null}
          refreshing={refreshing}
          watchCount={stats?.watch_count ?? 0}
          theme={theme} density={density}
          onRefresh={refresh} onSettings={() => setSettingsOpen(true)}
          onWatchlist={() => navigate("watchlist")} onReport={() => navigate("report/daily")}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onDensity={() => setDensity(density === "cozy" ? "compact" : "cozy")}
        />
        <TrackPage
          label={label}
          onBack={() => navigate("")}
          onOpen={setDetail}
          watched={watched}
          onWatch={toggleWatch}
        />
        <Modals />
      </>
    );
  }
  if (route.path === "watchlist") {
    return (
      <>
        <TopNav
          lastFetchAt={stats?.last_fetch?.finished_at ?? null}
          refreshing={refreshing}
          watchCount={stats?.watch_count ?? 0}
          theme={theme} density={density}
          onRefresh={refresh} onSettings={() => setSettingsOpen(true)}
          onWatchlist={() => navigate("")} onReport={() => navigate("report/daily")}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onDensity={() => setDensity(density === "cozy" ? "compact" : "cozy")}
        />
        <WatchlistPage onOpen={setDetail} onWatchChange={loadMeta} notify={notify} />
        <Modals />
      </>
    );
  }
  if (route.path.startsWith("report/")) {
    const kind = route.path.endsWith("weekly") ? "weekly" : "daily";
    return (
      <>
        <TopNav
          lastFetchAt={stats?.last_fetch?.finished_at ?? null}
          refreshing={refreshing}
          watchCount={stats?.watch_count ?? 0}
          theme={theme} density={density}
          onRefresh={refresh} onSettings={() => setSettingsOpen(true)}
          onWatchlist={() => navigate("watchlist")} onReport={() => navigate("")}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onDensity={() => setDensity(density === "cozy" ? "compact" : "cozy")}
        />
        <ReportPage kind={kind} onBack={() => navigate("")} notify={notify} />
        <Modals />
      </>
    );
  }

  const lastFetchAt = stats?.last_fetch?.finished_at ?? null;
  const title = board === "sub"
    ? `订阅 · ${subs.find((s) => s.id === subId)?.name ?? ""}`
    : BOARD_TITLES[board] ?? "榜单";

  function Modals() {
    return (
      <AnimatePresence>
        {detail && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <RepoDetail
              repo={detail}
              onClose={() => setDetail(null)}
              onNavigate={(full) => {
                const r = rows.find((x) => x.full_name === full);
                setDetail(r ?? ({ full_name: full } as Repo));
              }}
            />
          </motion.div>
        )}
        {settingsOpen && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <SettingsModal
              stats={stats}
              onClose={() => setSettingsOpen(false)}
              onConfigured={() => { loadMeta(); loadBoard(); }}
              notify={notify}
            />
          </motion.div>
        )}
        {subsOpen && (
          <motion.div key="subs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <SubsModal
              onClose={() => setSubsOpen(false)}
              onChange={() => { loadMeta(); loadBoard(); }}
              notify={notify}
            />
          </motion.div>
        )}
        {toast && (
          <motion.div key="toast" className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <CircleAlert size={14} style={{ color: "var(--accent)" }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <>
      <TopNav
        lastFetchAt={lastFetchAt}
        refreshing={refreshing}
        watchCount={stats?.watch_count ?? 0}
        theme={theme} density={density}
        onRefresh={refresh}
        onSettings={() => setSettingsOpen(true)}
        onWatchlist={() => navigate("watchlist")}
        onReport={() => navigate("report/daily")}
        onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onDensity={() => setDensity(density === "cozy" ? "compact" : "cozy")}
      />

      <Hero stats={stats} />

      {tracks.length > 0 && (
        <TrackStrip
          tracks={tracks}
          activeTrackId={trackId}
          onSelect={(id) => {
            setTrackId(id === 0 ? 0 : id);
            if (id !== 0) {
              const t = tracks.find((x) => x.id === id);
              if (t) navigate(`track/${encodeURIComponent(t.label)}`);
            }
          }}
        />
      )}

      <section className="section wrap">
        <Controls
          board={board}
          window={win}
          lang={lang}
          q={q}
          aiOnly={aiOnly}
          languages={data?.languages ?? []}
          subs={subs}
          subId={subId}
          onBoard={setBoard}
          onWindow={setWin}
          onLang={setLang}
          onQ={setQ}
          onAiOnly={setAiOnly}
          onSub={(id) => { setBoard("sub"); setSubId(id); }}
          onManageSubs={() => setSubsOpen(true)}
        />

        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ fontSize: 16 }}>
            {title}
            {trackId > 0 && (
              <span className="section-sub">· 赛道筛选:{tracks.find((t) => t.id === trackId)?.label ?? trackId}</span>
            )}
          </h2>
          {data && !loading && (
            <span className="section-sub" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
              {data.repos.length} 个项目 · 数据更新 {timeAgo(stats?.last_fetch?.finished_at)}
            </span>
          )}
        </div>

        <div className={`repo-list ${density === "compact" ? "compact" : ""}`}>
          {loading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel" />)}

          {!loading && loadError && (
            <div className="empty-state">
              <div className="big">榜单加载失败</div>
              <div>后端可能没有启动,或网络异常。</div>
              <button className="btn ghost" style={{ marginTop: 14 }} onClick={loadBoard}>重试</button>
            </div>
          )}

          {!loading && !loadError && data?.repos.length === 0 && (
            <div className="empty-state">
              <div className="big">{board === "cooling" ? "还没有降温的项目 —— 都很坚挺" : "没有匹配的项目"}</div>
              <div>换个筛选条件,或点击右上角刷新做一次新观测。</div>
            </div>
          )}

          {!loading && !loadError &&
            data?.repos.map((r, i) => (
              <RepoRow
                key={r.gh_id}
                repo={r}
                rank={i + 1}
                board={board}
                window={win}
                watched={watched.has(r.gh_id)}
                onOpen={setDetail}
                onWatch={toggleWatch}
                cursor={cursor === i}
                domainMax={sparkMax}
              />
            ))}
        </div>
      </section>

      <footer className="footer">
        <div className="wrap cols">
          <div>
            <b>StarRadar · GitHub 趋势雷达</b>
            <br />
            增速数据来自 GitHub Search API + 每日快照差值;标注 <span className="badge-est">≈</span>{" "}
            表示基于仓库年龄的估算(配置 GITHUB_TOKEN 后自动升级为精确采样)。
            快捷键:j/k 移动 · Enter 打开 · / 搜索。
          </div>
          <div>
            <b>榜单口径</b>
            <br />
            增速榜按窗口内新增 Star 排序;新秀榜限定创建 ≤30 天;
            黑马 = 日增速 &gt; 3× 同语言中位基线;共振 = GitHub 与 HN 同时起量。
          </div>
          <div>
            <b>技术栈</b>
            <br />
            FastAPI + SQLite · React + Recharts · HN Algolia ·
            点评与语义赛道由 GLM 提供(可选)。
          </div>
        </div>
      </footer>

      <Modals />
    </>
  );
}
