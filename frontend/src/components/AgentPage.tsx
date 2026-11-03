import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { api } from "../api";
import type { FetchRun, Notification, Stats } from "../types";
import { fmtInt, timeAgo } from "../utils";

interface Props {
  stats: Stats | null;
  notify: (msg: string) => void;
  onRefreshed: () => void;
}

type AgentStatus = {
  running: boolean;
  last_run: FetchRun | null;
  interval_hours: number;
  llm_ready: boolean;
  github_token: boolean;
};

export default function AgentPage({ stats, notify, onRefreshed }: Props) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [runs, setRuns] = useState<FetchRun[]>([]);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.agentStatus().then(setStatus).catch(() => {});
    api.runs(20).then((r) => setRuns(r.runs)).catch(() => {});
    api.notifications(0).then((r) => setNotifs(r.notifications)).catch(() => {});
  };
  useEffect(load, []);

  // 观测进行中时高频轮询,让状态真实流动
  useEffect(() => {
    if (!status?.running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [status?.running]);

  const observe = async () => {
    setBusy(true);
    notify("Agent 开始观测:搜索 → 增速测量 → 富化 → 赛道 → 通知");
    try {
      await api.agentStatus();
      const poll = setInterval(() => { api.agentStatus().then(setStatus).catch(() => {}); }, 4000);
      const r = await api.refresh();
      clearInterval(poll);
      notify(`观测完成:${r.repos} 个项目在册,新增 ${r.new} 个`);
      load();
      onRefreshed();
    } catch (e) {
      notify(`观测失败:${String(e).slice(0, 90)}`);
    } finally {
      setBusy(false);
      api.agentStatus().then(setStatus).catch(() => {});
    }
  };

  const running = busy || !!status?.running;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Agent 动态</h1>
        <p className="sub">
          观测管线每次执行的完整记录:候选搜索 → 增速测量 → 富化(共振 / commits / 营销检测)→ 赛道聚类 → 通知分发。
        </p>
      </div>

      <div className="panel agent-card" style={{ marginBottom: 14 }}>
        <div className="agent-info">
          <div className="agent-name">
            观测 Agent
            {running ? (
              <span className="status-pill run"><span className="dot" /> 运行中</span>
            ) : (
              <span className="status-pill idle">空闲</span>
            )}
          </div>
          <div className="agent-desc">
            自动观测间隔 {status?.interval_hours ?? 6} 小时;超过间隔后启动后自动补跑一轮。
          </div>
        </div>
        <div className="agent-chips">
          <span className="chip-meta" title="决定增速测量精度与 commit 数据">
            GITHUB_TOKEN {status?.github_token ? "✓" : "未配置"}
          </span>
          <span className="chip-meta" title="中文点评 / 语义赛道 / 报告导语">
            LLM {status?.llm_ready ? "✓" : "未配置"}
          </span>
          <button className="btn primary" onClick={observe} disabled={running}>
            {running ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
            立即观测
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>运行记录</h2>
          <span className="toolbar-sub">最近 {runs.length} 次</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="runs-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>开始时间</th>
                <th>耗时</th>
                <th>扫描</th>
                <th>新增</th>
                <th>产出</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const dur = r.started_at && r.finished_at
                  ? Math.max(1, Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000))
                  : null;
                return (
                  <tr key={r.id}>
                    <td>
                      {r.status === "ok"
                        ? <span className="status-pill ok"><span className="dot" />成功</span>
                        : r.status === "running"
                          ? <span className="status-pill run"><span className="dot" />运行中</span>
                          : <span className="status-pill err"><span className="dot" />失败</span>}
                    </td>
                    <td className="mono">{timeAgo(r.finished_at || r.started_at)}</td>
                    <td className="mono">{dur ? `${dur}s` : "—"}</td>
                    <td className="mono">{fmtInt(r.repos_seen)}</td>
                    <td className="mono">+{fmtInt(r.repos_new)}</td>
                    <td className="mono">{r.note || "—"}</td>
                  </tr>
                );
              })}
              {runs.length === 0 && (
                <tr><td colSpan={6} style={{ color: "var(--faint)" }}>还没有运行记录 —— 点「立即观测」跑第一轮。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 15 }}>通知流</h2>
        <span className="toolbar-sub">里程碑 / 暴增 / 报告的分发记录</span>
      </div>
      <div className="notif-box">
        {notifs.length === 0 && (
          <div className="notif-item" style={{ color: "var(--faint)" }}>暂无通知。关注项目并配置推送通道后,这里会记录每一次分发。</div>
        )}
        {notifs.map((n) => (
          <div key={n.id} className="notif-item">
            <span className={`notif-kind ${n.kind}`}>{n.kind}</span>
            <span className="notif-title">{n.title}</span>
            <span className="notif-time">{n.created_at.slice(5, 16).replace("T", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
