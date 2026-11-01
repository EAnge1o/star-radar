import { useEffect, useState } from "react";
import { ExternalLink, FileText, Flame, GitCommitHorizontal, Snowflake, Sparkles, X } from "lucide-react";
import { api } from "../api";
import type { Repo, RepoDetail as Detail } from "../types";
import { fmtAge, fmtInt, fmtNum, langColor, timeAgo } from "../utils";
import TrendChart from "./TrendChart";
import Sparkline from "./Sparkline";

export default function RepoDetail({ repo, onClose, onNavigate }: { repo: Repo; onClose: () => void; onNavigate?: (full: string) => void }) {
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
  const related = detail?.related ?? [];

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
              {d.cooling === 1 && (
                <span className="badge cold" style={{ marginLeft: 8, verticalAlign: "middle" }}>
                  <Snowflake size={10} /> 降温
                </span>
              )}
            </h2>
            <p className="detail-desc">{d.description || "暂无官方描述"}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8, fontSize: 12, color: "var(--faint)" }}>
              {d.language && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="lang-dot" style={{ background: langColor(d.language) }} />
                  {d.language}
                </span>
              )}
              <span>创建于 {d.created_at?.slice(0, 10) || "—"}({fmtAge(d.created_at)})</span>
              <span>最近推送 {timeAgo(d.pushed_at)}</span>
              {d.license && <span>{d.license}</span>}
              {d.owner_type === "Organization" && <span>组织出品</span>}
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
          <div className="stat-box">
            <div className="k">
              <GitCommitHorizontal size={11} style={{ verticalAlign: -2 }} /> 近7日 COMMITS
            </div>
            <div className="v">{d.commits_7d != null ? fmtInt(d.commits_7d) : "—"}</div>
          </div>
          <div className="stat-box">
            <div className="k">HN 热度</div>
            <div className="v" style={{ color: d.resonance === 1 ? "var(--cyan)" : undefined }}>
              {d.hn_points ? `${fmtInt(d.hn_points)} pts` : "—"}
            </div>
          </div>
          <div className="stat-box">
            <div className="k">FORK/STAR</div>
            <div className="v">{d.stars ? ((d.forks / d.stars) * 100).toFixed(1) + "%" : "—"}</div>
          </div>
          <div className="stat-box">
            <div className="k">代码规模</div>
            <div className="v">
              {d.size != null && d.size > 0 ? (d.size >= 1024 ? (d.size / 1024).toFixed(1) + " MB" : d.size + " KB") : "—"}
            </div>
          </div>
        </div>

        {d.readme_summary && (
          <div className="readme-card">
            <div className="label">
              <FileText size={12} /> README 摘要
            </div>
            <div className="point">{d.readme_summary}</div>
          </div>
        )}

        <div className="detail-chart">
          <div className="label">
            {snaps.length > 1
              ? "STAR 累计曲线(雷达每日快照)"
              : d.spark && d.spark.length > 2
                ? "近期星标节奏(最近 100 次 Star 的时间分布)"
                : "STAR 增长轨迹 · 观测数据累积中"}
          </div>
          {snaps.length > 1 ? (
            <TrendChart
              data={snaps.map((s) => ({ t: s.taken_at.slice(5, 10), v: s.stars }))}
            />
          ) : (
            <Sparkline spark={d.spark} height={d.spark && d.spark.length > 2 ? 170 : 120} showAxis />
          )}
        </div>

        {related.length > 0 && (
          <div className="related-box">
            <div className="label">同赛道项目 · 顺着逛</div>
            <div className="related-list">
              {related.map((x) => (
                <button key={x.full_name} className="related-item" onClick={() => onNavigate?.(x.full_name)}>
                  <span className="mono">{x.full_name}</span>
                  <span className="sub">{fmtNum(x.stars)} ★ · {x.language || "—"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
