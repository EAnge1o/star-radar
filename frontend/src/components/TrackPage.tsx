import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../api";
import type { Repo, TrackPageData } from "../types";
import { fmtNum, trackColor } from "../utils";
import RepoRow from "./RepoRow";
import TrendChart from "./TrendChart";

/** 签名动作:把选中的赛道画成一条线路——站点 = 头部项目,双环 = HN 共振换乘。 */
function LineDiagram({ label, members }: { label: string; members: Repo[] }) {
  const stops = members.slice(0, 6);
  if (stops.length < 2) return null;
  const color = trackColor(members[0].track_id);
  const LEVELS = [38, 82];
  const spacing = 180;
  const startX = 70;
  const diag = 22; // 45° 折角的水平投影 = 竖直落差

  type Stop = { x: number; y: number; repo: Repo };
  const points: Stop[] = stops.map((r, i) => ({
    x: startX + i * spacing,
    y: LEVELS[i % 2],
    repo: r,
  }));

  let d = `M ${points[0].x - 40} ${points[0].y}`;
  d += ` L ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dir = cur.y > prev.y ? 1 : -1;
    d += ` L ${cur.x - diag} ${prev.y}`;
    d += ` L ${cur.x} ${cur.y}`;
  }
  d += ` L ${points[points.length - 1].x + 40} ${points[points.length - 1].y}`;

  const maxStars = Math.max(...stops.map((s) => s.stars), 1);

  return (
    <div className="detail-chart" style={{ padding: "18px 12px 6px", overflowX: "auto" }}>
      <div className="label">
        线路图 · 圆点为头部项目,大小按 Star;双环为 HN 换乘;折角恒 45°
      </div>
      <svg viewBox="0 0 1060 120" style={{ width: "100%", minWidth: 720, display: "block" }} role="img"
        aria-label={`${label} 线路图`}>
        {/* 远处并行的他线,衬托本线最亮 */}
        {[16, 104].map((y) => (
          <polyline key={y} points={`0,${y} 1060,${y}`} fill="none"
            stroke="var(--line-soft)" strokeWidth="3" />
        ))}
        {/* 本线:最亮 */}
        <path d={d} fill="none" stroke={color} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(({ x, y, repo }) => {
          const r = 7 + (repo.stars / maxStars) * 6;
          const res = repo.resonance === 1;
          return (
            <g key={repo.gh_id}>
              {res && <circle cx={x} cy={y} r={r + 5} fill="none" stroke="var(--ink)" strokeWidth="1.6" />}
              <circle cx={x} cy={y} r={r} fill="var(--bg0)" stroke={color} strokeWidth="2.6" />
              <text x={x} y={y + r + 16} textAnchor="middle" fill="var(--sub)" fontSize="11"
                fontFamily="JetBrains Mono Variable">
                {repo.full_name.split("/")[1]}
              </text>
              <text x={x} y={y - r - 8} textAnchor="middle" fill="var(--faint)" fontSize="10"
                fontFamily="JetBrains Mono Variable">
                {fmtNum(repo.stars)}★
              </text>
            </g>
          );
        })}
        <text x={points[0].x - 44} y={points[0].y - 46} fill={color} fontSize="13"
          fontFamily="Overpass Variable" fontWeight={700} textAnchor="start">
          {label}
        </text>
      </svg>
    </div>
  );
}

interface Props {
  label: string;
  onBack: () => void;
  onOpen: (r: import("../types").Repo) => void;
  watched: Set<number>;
  onWatch: (r: import("../types").Repo) => void;
}

export default function TrackPage({ label, onBack, onOpen, watched, onWatch }: Props) {
  const [data, setData] = useState<TrackPageData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setData(null);
    setErr(false);
    api.trackView(label).then(setData).catch(() => setErr(true));
  }, [label]);

  if (err) {
    return (
      <div className="page wrap">
        <div className="empty-state">
          <div className="big">赛道不存在或已重组</div>
          <div>赛道每次观测会重新聚类,回首页看看最新的吧。</div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={onBack}>
            <ArrowLeft size={14} /> 返回榜单
          </button>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="wrap page">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" />)}</div>;
  }

  const { track, members } = data;
  const hist = track.heat_history.map((h) => ({
    t: h.taken_at.slice(5, 10),
    v: Math.round(h.heat * 1000) / 10,
  }));

  return (
    <div className="page wrap">
      <button className="btn ghost back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> 返回
      </button>

      <div className="track-hero">
        <div>
          <h1 className="hero-title" style={{ fontSize: 34 }}>
            {track.label}
          </h1>
          <p className="hero-desc" style={{ marginBottom: 10 }}>
            {track.summary || "—"}
          </p>
          <span className="section-sub" style={{ fontFamily: "var(--font-mono)" }}>
            TRACK · {track.size} 个项目 · 热度 {(track.heat * 100).toFixed(0)} · 聚类方式 {track.method === "llm-embed" ? "语义聚类" : "主题词典"}
          </span>
        </div>
      </div>

      <LineDiagram label={track.label} members={members} />

      {hist.length > 1 && (
        <div className="detail-chart">
          <div className="label">线路热度曲线(组内近 7 日 Star 占比,%)</div>
          <TrendChart data={hist} height={170} domainPad={3} />
        </div>
      )}

      <div className="section-head" style={{ marginTop: 26 }}>
        <h2 className="section-title" style={{ fontSize: 16 }}>沿线站点</h2>
        <span className="section-sub">{members.length} 个项目 · 按综合增速排序</span>
      </div>
      <div className="repo-list">
        {members.map((r, i) => (
          <RepoRow
            key={r.gh_id}
            repo={r}
            rank={i + 1}
            board="track"
            window="7d"
            stagger={false}
            watched={watched.has(r.gh_id)}
            onOpen={onOpen}
            onWatch={onWatch}
          />
        ))}
      </div>
    </div>
  );
}
