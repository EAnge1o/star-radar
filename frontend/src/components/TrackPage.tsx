import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../api";
import type { TrackPageData } from "../types";
import RepoRow from "./RepoRow";
import TrendChart from "./TrendChart";

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

      {hist.length > 1 && (
        <div className="detail-chart">
          <div className="label">赛道热度曲线(组内近 7 日 Star 占比,%)</div>
          <TrendChart data={hist} height={170} domainPad={3} />
        </div>
      )}

      <div className="section-head" style={{ marginTop: 26 }}>
        <h2 className="section-title" style={{ fontSize: 16 }}>成员榜单</h2>
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
