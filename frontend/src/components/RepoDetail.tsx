import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis } from "recharts";
import { ExternalLink, Flame, Sparkles, X } from "lucide-react";
import { api } from "../api";
import type { Repo, RepoDetail as Detail } from "../types";
import { fmtAge, fmtInt, fmtNum, langColor, timeAgo } from "../utils";
import Sparkline from "./Sparkline";

export default function RepoDetail({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    setDetail(null);
    api.repo(repo.full_name).then(setDetail).catch(() => setDetail(null));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [repo.full_name]);

  const d = detail ?? repo;
  const snaps = detail?.snapshots ?? [];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose}>
          <X size={15} />
        </button>

        <div className="detail-head">
          {d.avatar_url && <img className="detail-avatar" src={d.avatar_url} alt="" />}
          <div style={{ minWidth: 0 }}>
            <h2 className="detail-title">
              <span className="owner">{d.owner}/</span>
              {d.full_name.split("/")[1]}
              {d.black_horse === 1 && (
                <span className="badge fire" style={{ marginLeft: 10, verticalAlign: "middle" }}>
                  <Flame size={10} /> 黑马
                </span>
              )}
            </h2>
            <p className="detail-desc">{d.description || "暂无官方描述"}</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, fontSize: 12, color: "var(--faint)" }}>
              {d.language && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="lang-dot" style={{ background: langColor(d.language) }} />
                  {d.language}
                </span>
              )}
              <span>创建于 {d.created_at?.slice(0, 10) || "—"}({fmtAge(d.created_at)})</span>
              <span>最近推送 {timeAgo(d.pushed_at)}</span>
              {d.license && <span>{d.license}</span>}
            </div>
            <a className="detail-cta" href={`https://github.com/${d.full_name}`} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> 在 GitHub 打开
            </a>
          </div>
        </div>

        {d.commentary && (
          <div className="comment-card">
            <div className="label">
              <Sparkles size={12} /> AI 点评 · {d.commentary_model || "GLM"}
            </div>
            <div className="point">{d.commentary}</div>
            {d.commentary_why && (
              <div className="why">
                为什么火:<b>{d.commentary_why}</b>
              </div>
            )}
          </div>
        )}

        <div className="detail-grid">
          <div className="stat-box">
            <div className="k">STARS</div>
            <div className="v">{fmtInt(d.stars)}</div>
          </div>
          <div className="stat-box">
            <div className="k">FORKS</div>
            <div className="v">{fmtInt(d.forks)}</div>
          </div>
          <div className="stat-box">
            <div className="k">近7日增速</div>
            <div className="v" style={{ color: "var(--green)" }}>
              {d.velocity_est === 1 ? "≈" : ""}+{fmtNum(d.stars_7d)}
            </div>
          </div>
          <div className="stat-box">
            <div className="k">OPEN ISSUES</div>
            <div className="v">{fmtInt(d.open_issues)}</div>
          </div>
        </div>

        <div className="detail-chart">
          <div className="label">
            {snaps.length > 1
              ? "STAR 累计曲线(雷达每日快照)"
              : d.spark && d.spark.length > 2
                ? "近期星标节奏(最近 100 次 Star 的时间分布)"
                : "STAR 增长轨迹 · 观测数据累积中"}
          </div>
          {snaps.length > 1 ? (
            <SnapshotChart snaps={snaps} />
          ) : (
            <Sparkline spark={d.spark} height={d.spark && d.spark.length > 2 ? 170 : 120} showAxis />
          )}
        </div>

        {d.topics && d.topics.length > 0 && (
          <div className="detail-topics">
            {d.topics.map((t) => (
              <span key={t} className="topic-tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotChart({ snaps }: { snaps: { stars: number; taken_at: string }[] }) {
  const data = snaps.map((s) => ({
    t: s.taken_at.slice(5, 10),
    v: s.stars,
  }));
  return (
    <SparkBars data={data} />
  );
}

function SparkBars({ data }: { data: { t: string; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dc-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="dc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          tick={{ fill: "#5f6b85", fontSize: 10.5, fontFamily: "JetBrains Mono Variable" }}
          axisLine={{ stroke: "rgba(148,163,184,.15)" }}
          tickLine={false}
          minTickGap={36}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke="url(#dc-stroke)"
          strokeWidth={2.2}
          fill="url(#dc-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
