import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert } from "lucide-react";
import { api, type BoardQuery } from "./api";
import type { BoardResp, Repo, Stats, Track } from "./types";
import { timeAgo } from "./utils";
import Controls, { type BoardKind, type WindowKind } from "./components/Controls";
import Hero from "./components/Hero";
import RepoDetail from "./components/RepoDetail";
import RepoRow from "./components/RepoRow";
import SettingsModal from "./components/SettingsModal";
import TopNav from "./components/TopNav";
import TrackStrip from "./components/TrackStrip";

const BOARD_TITLES: Record<BoardKind, string> = {
  velocity: "增速榜 · 谁在真金白银地涨",
  fresh: "新秀榜 · 近 30 天出生的爆发项目",
  total: "总量榜 · 已成气候的巨头",
};

export default function App() {
  const [board, setBoard] = useState<BoardKind>("velocity");
  const [win, setWin] = useState<WindowKind>("7d");
  const [lang, setLang] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [trackId, setTrackId] = useState(0);

  const [data, setData] = useState<BoardResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Repo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const query: BoardQuery = { board, window: win, lang, q: qDebounced, ai_only: aiOnly, track_id: trackId, limit: 60 };

  const loadBoard = useCallback(() => {
    setLoading(true);
    api.board(query)
      .then(setData)
      .catch(() => notify("榜单加载失败,请确认后端已启动"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, win, lang, qDebounced, aiOnly, trackId]);

  const loadMeta = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.tracks().then((r) => setTracks(r.tracks)).catch(() => {});
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const refresh = async () => {
    setRefreshing(true);
    notify("雷达正在扫描 GitHub,约需 30-90 秒…");
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

  const lastFetchAt = stats?.last_fetch?.finished_at ?? null;

  return (
    <>
      <TopNav
        lastFetchAt={lastFetchAt}
        refreshing={refreshing}
        onRefresh={refresh}
        onSettings={() => setSettingsOpen(true)}
      />

      <Hero stats={stats} />

      {tracks.length > 0 && (
        <TrackStrip tracks={tracks} activeTrackId={trackId} onSelect={setTrackId} />
      )}

      <section className="section wrap">
        <Controls
          board={board}
          window={win}
          lang={lang}
          q={q}
          aiOnly={aiOnly}
          languages={data?.languages ?? []}
          onBoard={setBoard}
          onWindow={setWin}
          onLang={setLang}
          onQ={setQ}
          onAiOnly={setAiOnly}
        />

        <div className="section-head" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ fontSize: 16 }}>
            {BOARD_TITLES[board]}
            {trackId > 0 && (
              <span className="section-sub">
                · 赛道筛选:{tracks.find((t) => t.id === trackId)?.label ?? trackId}
              </span>
            )}
          </h2>
          {data && !loading && (
            <span className="section-sub" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
              {data.repos.length} 个项目 · 数据更新 {timeAgo(stats?.last_fetch?.finished_at)}
            </span>
          )}
        </div>

        <div className="repo-list">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel" />)}

          {!loading && data?.repos.length === 0 && (
            <div className="empty-state">
              <div className="big">没有匹配的项目</div>
              <div>换个筛选条件,或点击右上角刷新做一次新观测。</div>
            </div>
          )}

          {!loading &&
            data?.repos.map((r, i) => (
              <RepoRow
                key={r.gh_id}
                repo={r}
                rank={i + 1}
                board={board}
                window={win}
                onOpen={setDetail}
              />
            ))}
        </div>
      </section>

      <footer className="footer">
        <div className="wrap cols">
          <div>
            <b>StarRadar · 开源趋势雷达</b>
            <br />
            增速数据来自 GitHub Search API + 每日快照差值;标注 <span className="badge-est">≈</span>{" "}
            表示基于仓库年龄的估算(配置 GITHUB_TOKEN 后自动升级为精确采样)。
          </div>
          <div>
            <b>榜单口径</b>
            <br />
            增速榜按窗口内新增 Star 排序;新秀榜限定创建 ≤30 天;
            黑马 = 日增速 &gt; 3× 同语言中位基线。
          </div>
          <div>
            <b>技术栈</b>
            <br />
            FastAPI + SQLite + APScheduler 风格调度 · React + Recharts ·
            点评与赛道聚类由 GLM 提供(可选)。
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <RepoDetail repo={detail} onClose={() => setDetail(null)} />
          </motion.div>
        )}
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <SettingsModal
              stats={stats}
              onClose={() => setSettingsOpen(false)}
              onConfigured={() => {
                loadMeta();
                loadBoard();
              }}
              notify={notify}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <CircleAlert size={14} style={{ color: "var(--cyan)" }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
