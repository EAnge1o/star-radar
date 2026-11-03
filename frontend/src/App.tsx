import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, Menu } from "lucide-react";
import { api, type BoardQuery } from "./api";
import type { BoardResp, Notification, Repo, Stats, Sub, Track } from "./types";
import { timeAgo } from "./utils";
import { navigate, syncBoardQuery, useHashRoute } from "./useHashRoute";
import AgentPage from "./components/AgentPage";
import ConfirmDialog from "./components/ConfirmDialog";
import Controls, { type BoardKind, type WindowKind } from "./components/Controls";
import Dashboard from "./components/Dashboard";
import RepoDetail from "./components/RepoDetail";
import RepoRow from "./components/RepoRow";
import ReportPage from "./components/ReportPage";
import SettingsModal from "./components/SettingsModal";
import WatchlistPage from "./components/WatchlistPage";
import Sidebar, { type RouteName } from "./components/Sidebar";
import SubsModal from "./components/SubsModal";
import TrackPage from "./components/TrackPage";
import TrackStrip from "./components/TrackStrip";

export type SortKey = "score" | "stars" | "name";

const BOARD_TITLES: Record<string, string> = {
  velocity: "增速榜",
  fresh: "新秀榜",
  total: "总量榜",
  cooling: "降温榜",
};

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
  const [limit, setLimit] = useState(60);
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const [data, setData] = useState<BoardResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Repo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{ title: string; body: string; danger?: boolean; confirmText?: string; action: () => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("sr-theme") as "dark" | "light") || "light");
  const [density, setDensity] = useState<"cozy" | "compact">(() => (localStorage.getItem("sr-density") as "cozy" | "compact") || "cozy");
  const [cursor, setCursor] = useState(-1);
  const lastNotifId = useRef(0);
  const toastTimer = useRef(0);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    localStorage.setItem("sr-theme", theme);
    localStorage.setItem("sr-density", density);
  }, [theme, density]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  // 榜单状态 → URL(可分享)
  useEffect(() => {
    if (route.path === "boards") {
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
    track_id: trackId, sub_id: subId, limit,
  };

  const loadBoard = useCallback(() => {
    setLoading(true);
    api.board(query)
      .then((d) => { setData(d); setLoadError(false); })
      .catch(() => { setLoadError(true); notify("榜单加载失败,请确认后端已启动"); })
      .finally(() => { setLoading(false); setCursor(-1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, win, lang, qDebounced, aiOnly, trackId, subId, limit]);

  const loadMeta = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.tracks().then((r) => setTracks(r.tracks)).catch(() => {});
    api.subs.list().then((r) => setSubs(r.subs)).catch(() => {});
    api.watch.list().then((r) => setWatched(new Set(r.repos.map((x) => x.gh_id)))).catch(() => {});
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Agent 状态 + 通知轮询
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.agentStatus();
        if (!alive) return;
        setAgentRunning(s.running);
        const n = await api.notifications(lastNotifId.current);
        for (const item of n.notifications) {
          if (item.id > lastNotifId.current) lastNotifId.current = item.id;
          if (item.kind === "test") continue;
          notify(item.title);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("StarRadar", { body: item.title + (item.message ? `\n${item.message}` : "") });
          }
        }
      } catch { /* 后端未启动时静默 */ }
    };
    poll();
    const t = setInterval(poll, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [notify]);

  const refresh = async () => {
    setRefreshing(true);
    notify("Agent 开始观测:搜索 → 增速测量 → 富化 → 赛道 → 通知");
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
      setConfirmState({
        title: "取消关注?",
        body: `将不再推送 ${r.full_name} 的里程碑与暴增通知。`,
        danger: true,
        confirmText: "取消关注",
        action: async () => {
          await api.watch.remove(r.gh_id);
          notify(`已取消关注 ${r.full_name}`);
          api.watch.list().then((x) => setWatched(new Set(x.repos.map((y) => y.gh_id)))).catch(() => {});
          api.stats().then(setStats).catch(() => {});
        },
      });
      return;
    }
    try {
      await api.watch.add(r.full_name);
      notify(`已关注 ${r.full_name}:破里程碑或单日暴增时会推送`);
    } catch (e) {
      notify(String(e).slice(0, 90));
    }
    api.watch.list().then((x) => setWatched(new Set(x.repos.map((y) => y.gh_id)))).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  };

  const rows = data?.repos ?? [];
  const sparkMax = useMemo(
    () => (rows.length ? Math.max(1, ...rows.flatMap((r) => (r.spark ?? []).map(([, v]) => v))) : undefined),
    [rows]
  );
  const sortedRows = useMemo(() => {
    if (sortKey === "stars") return [...rows].sort((a, b) => b.stars - a.stars);
    if (sortKey === "name") return [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return rows;
  }, [rows, sortKey]);

  // 键盘导航:j / k / Enter / /
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (route.path !== "boards" || detail) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("board-search")?.focus();
      } else if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "j" ? Math.min(c + 1, sortedRows.length - 1) : Math.max(c - 1, 0);
          document.querySelector(".row-cursor")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "Enter") {
        if (cursor >= 0 && sortedRows[cursor]) setDetail(sortedRows[cursor]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sortedRows, cursor, route.path, detail]);

  const routeName: RouteName =
    route.path === "watchlist" ? "watchlist"
    : route.path === "agent" ? "agent"
    : route.path.startsWith("report") ? "report"
    : route.path.startsWith("track/") ? "boards"
    : route.path === "boards" ? "boards"
    : "home";

  const toolbarTitle =
    route.path === "watchlist" ? "Watchlist"
    : route.path === "agent" ? "Agent 动态"
    : route.path.startsWith("report") ? (route.path.endsWith("weekly") ? "每周报告" : "每日报告")
    : route.path.startsWith("track/") ? "赛道详情"
    : route.path === "boards" ? (board === "sub" ? `订阅 · ${subs.find((s) => s.id === subId)?.name ?? ""}` : BOARD_TITLES[board] ?? "趋势榜")
    : "总览";

  const lastFetchAt = stats?.last_fetch?.finished_at ?? null;

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="shell">
        <Sidebar
          route={routeName}
          watchCount={stats?.watch_count ?? 0}
          theme={theme}
          open={drawerOpen}
          onNavigate={(r) => {
            setDrawerOpen(false);
            if (r === "subs") { navigate("boards"); setSubsOpen(true); return; }
            if (r === "report") { navigate("report/daily"); return; }
            navigate(r);
          }}
          onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onSettings={() => setSettingsOpen(true)}
          onClose={() => setDrawerOpen(false)}
        />
        <div className="main">
          <header className="toolbar">
            <button className="icon-btn menu-btn" onClick={() => setDrawerOpen(true)} title="菜单" aria-label="菜单">
              <Menu size={16} />
            </button>
            <div className="toolbar-title">{toolbarTitle}</div>
            <div className="toolbar-right">
              {agentRunning && (
                <span className="status-pill run"><span className="dot" /> Agent 观测中…</span>
              )}
              <span className="toolbar-sub">最近观测 {timeAgo(lastFetchAt)}</span>
              <button className="icon-btn" onClick={refresh} disabled={refreshing} title="立即观测一轮" aria-label="立即观测">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={refreshing ? { animation: "spin 0.9s linear infinite" } : undefined}>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
              <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="设置" aria-label="设置">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    );
  }

  function Modals() {
    return (
      <AnimatePresence>
        {detail && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
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
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <SettingsModal
              stats={stats}
              onClose={() => setSettingsOpen(false)}
              onConfigured={() => { loadMeta(); loadBoard(); }}
              notify={notify}
            />
          </motion.div>
        )}
        {subsOpen && (
          <motion.div key="subs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <SubsModal
              onClose={() => setSubsOpen(false)}
              onChange={() => { loadMeta(); loadBoard(); }}
              notify={notify}
              confirm={(s) => setConfirmState({ title: s.title, body: s.body, danger: s.danger, confirmText: s.confirmText, action: s.action })}
            />
          </motion.div>
        )}
        {confirmState && (
          <ConfirmDialog
            title={confirmState.title}
            body={confirmState.body}
            confirmText={confirmState.confirmText}
            danger={confirmState.danger}
            onConfirm={confirmState.action}
            onClose={() => setConfirmState(null)}
          />
        )}
        {toast && (
          <motion.div key="toast" className="toast" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <CircleAlert size={14} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ---- 赛道详情 ----
  if (route.path.startsWith("track/")) {
    const label = decodeURIComponent(route.path.slice("track/".length));
    return (
      <Shell>
        <TrackPage label={label} onBack={() => navigate("boards")} onOpen={setDetail} watched={watched} onWatch={toggleWatch} />
        <Modals />
      </Shell>
    );
  }

  // ---- Watchlist ----
  if (route.path === "watchlist") {
    return (
      <Shell>
        <WatchlistPage onOpen={setDetail} onWatchChange={loadMeta} notify={notify} confirm={setConfirmState} />
        <Modals />
      </Shell>
    );
  }

  // ---- 报告 ----
  if (route.path.startsWith("report")) {
    const kind = route.path.endsWith("weekly") ? "weekly" : "daily";
    return (
      <Shell>
        <ReportPage kind={kind} onBack={() => navigate("home")} notify={notify} />
        <Modals />
      </Shell>
    );
  }

  // ---- Agent 动态 ----
  if (route.path === "agent") {
    return (
      <Shell>
        <AgentPage stats={stats} notify={notify} onRefreshed={() => { loadBoard(); loadMeta(); }} />
        <Modals />
      </Shell>
    );
  }

  // ---- 总览 ----
  if (route.path === "" || route.path === "home") {
    return (
      <Shell>
        <Dashboard
          stats={stats}
          tracks={tracks}
          notifs={notifs}
          onOpenTrack={(t) => navigate(`track/${encodeURIComponent(t.label)}`)}
          onGoto={(r) => navigate(r)}
        />
        <Modals />
      </Shell>
    );
  }

  // ---- 趋势榜(默认) ----
  return (
    <Shell>
      <Controls
        board={board}
        window={win}
        lang={lang}
        q={q}
        aiOnly={aiOnly}
        languages={data?.languages ?? []}
        subs={subs}
        subId={subId}
        sortKey={sortKey}
        onBoard={(b) => { setBoard(b); setLimit(60); }}
        onWindow={(w) => { setWin(w); setLimit(60); }}
        onLang={setLang}
        onQ={setQ}
        onAiOnly={setAiOnly}
        onSub={(id) => { setBoard("sub"); setSubId(id); setLimit(60); }}
        onManageSubs={() => setSubsOpen(true)}
        onSort={setSortKey}
      />

      <div className="section-head" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15 }}>
          {BOARD_TITLES[board] ?? "榜单"}
          {board === "sub" && subs.find((s) => s.id === subId) ? ` · ${subs.find((s) => s.id === subId)?.name}` : ""}
          {trackId > 0 && (
            <span className="toolbar-sub" style={{ marginLeft: 10 }}>
              赛道筛选:{tracks.find((t) => t.id === trackId)?.label ?? trackId}
            </span>
          )}
        </h2>
        {data && !loading && !loadError && (
          <span className="toolbar-sub" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
            {data.repos.length} 个项目 · 更新 {timeAgo(stats?.last_fetch?.finished_at)}
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
          sortedRows.map((r, i) => (
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

      {!loading && !loadError && data && data.repos.length >= limit && (
        <div className="load-more">
          <button className="btn ghost" onClick={() => setLimit((l) => l + 60)}>加载更多</button>
        </div>
      )}

      <Modals />
    </Shell>
  );
}
