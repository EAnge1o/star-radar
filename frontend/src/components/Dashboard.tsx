import { Activity, Bot, FileText, Flame, Radio, Star, TrendingUp, Users } from "lucide-react";
import type { Notification, Stats, Track } from "../types";
import { fmtInt, fmtNum, timeAgo, trackColor } from "../utils";

interface Props {
  stats: Stats | null;
  tracks: Track[];
  notifs: Notification[];
  onOpenTrack: (t: Track) => void;
  onGoto: (r: "boards" | "agent" | "report" | "watchlist") => void;
}

export default function Dashboard({ stats, tracks, notifs, onOpenTrack, onGoto }: Props) {
  const kpis = [
    { label: "追踪仓库", icon: <Radio size={13} />, value: stats?.total_repos ?? 0, delta: `最近观测 ${timeAgo(stats?.last_fetch?.finished_at)}` },
    { label: "今日新增 Star", icon: <TrendingUp size={13} />, value: stats?.today_new_stars ?? 0, delta: "全网合计,快照差值实测", fmt: true },
    { label: "近 30 天新秀", icon: <Users size={13} />, value: stats?.newcomers ?? 0, delta: "创建 ≤30 天的项目" },
    { label: "双平台共振", icon: <Activity size={13} />, value: stats?.resonant ?? 0, delta: "GitHub × HN 同时起量" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>总览</h1>
        <p className="sub">
          观测 Agent 持续重绘 GitHub 趋势线网:增速实测为准,黑马以橙色标记,估算值一律带 ≈。
        </p>
      </div>

      <div className="dash-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-label">{k.icon}{k.label}</div>
            <div className="kpi-value">{k.fmt ? "+" + fmtNum(k.value) : fmtInt(k.value)}</div>
            <div className="kpi-delta">{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="panel agent-card" style={{ marginBottom: 14 }}>
        <div className="agent-info">
          <div className="agent-name">
            <Bot size={16} /> 观测 Agent
            {stats?.last_fetch ? (
              <span className="status-pill ok"><span className="dot" />最近一轮成功</span>
            ) : (
              <span className="status-pill idle">尚未运行</span>
            )}
          </div>
          <div className="agent-desc">
            {stats?.last_fetch
              ? `最近一轮:${timeAgo(stats.last_fetch.finished_at)} · 扫描 ${fmtInt(stats.last_fetch.repos_seen)} 个项目,新收录 ${fmtInt(stats.last_fetch.repos_new)} 个`
              : "还没有运行记录——点「立即观测」开始第一轮。"}
          </div>
        </div>
        <div className="agent-chips">
          <span className="chip-meta">每 {6} 小时自动观测</span>
          <button className="btn primary" onClick={() => onGoto("agent")}>
            <Bot size={14} /> Agent 动态与手动观测
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <h2>赛道线网</h2>
          <span className="more" style={{ color: "var(--faint)" }}>
            {tracks.length} 条线路 · 热度为线路内近 7 日 Star 占比
          </span>
        </div>
        <div className="track-row">
          {tracks.map((t) => {
            const c = trackColor(t.id);
            return (
              <div key={t.id} className="track-card" onClick={() => onOpenTrack(t)}>
                <div className="track-label">
                  <span className="track-dot" style={{ background: c }} />
                  {t.label}
                </div>
                <div className="track-summary">{t.summary || "—"}</div>
                <div className="track-meta">
                  <span>{t.size} 个项目</span>
                  <span style={{ color: c }}>热度 {(t.heat * 100).toFixed(0)}</span>
                </div>
              </div>
            );
          })}
          {tracks.length === 0 && (
            <div style={{ color: "var(--faint)", fontSize: 12.5 }}>第一轮观测完成后,这里会显示赛道分布。</div>
          )}
        </div>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="panel">
          <div className="panel-head">
            <h2>最近通知</h2>
            <button className="more" style={{ background: "none", border: 0, cursor: "pointer", color: "var(--primary)", fontWeight: 600 }} onClick={() => onGoto("agent")}>
              全部动态 →
            </button>
          </div>
          <div className="notif-box" style={{ border: 0, margin: "8px 8px 10px" }}>
            {notifs.length === 0 && (
              <div className="notif-item" style={{ color: "var(--faint)" }}>暂无通知。Watchlist 里程碑与暴增会出现在这里。</div>
            )}
            {notifs.slice(0, 5).map((n) => (
              <div key={n.id} className="notif-item">
                <span className={`notif-kind ${n.kind}`}>{n.kind}</span>
                <span className="notif-title">{n.title}</span>
                <span className="notif-time">{n.created_at.slice(5, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>快捷入口</h2>
          </div>
          <div style={{ padding: "12px 20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <QuickLink icon={<TrendingUp size={15} />} title="趋势榜" desc="增速 / 新秀 / 总量 / 降温四榜与订阅页签" onClick={() => onGoto("boards")} />
            <QuickLink icon={<Star size={15} />} title="Watchlist" desc={`已关注 ${stats?.watch_count ?? 0} 个项目,里程碑与暴增推送`} onClick={() => onGoto("watchlist")} />
            <QuickLink icon={<FileText size={15} />} title="每日 / 每周报告" desc="可分享、可推送的趋势总结" onClick={() => onGoto("report")} />
            <QuickLink icon={<Flame size={15} />} title={`黑马监控(当前 ${stats?.black_horses ?? 0} 匹)`} desc="增速 > 3× 同语言基线的爆发项目" onClick={() => onGoto("boards")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button className="side-item" onClick={onClick} style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", padding: "10px 12px", alignItems: "flex-start" }}>
      <span style={{ marginTop: 2, color: "var(--primary)" }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: "var(--faint)", fontWeight: 400 }}>{desc}</span>
      </span>
    </button>
  );
}
