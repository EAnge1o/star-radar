import { ChevronRight, Flame, Snowflake, Sparkles, Star, TriangleAlert, Waves } from "lucide-react";
import { motion } from "framer-motion";
import type { Repo } from "../types";
import { fmtAge, fmtNum, langColor } from "../utils";
import Sparkline from "./Sparkline";

interface Props {
  repo: Repo;
  rank: number;
  board: string;
  window: string;
  watched?: boolean;
  stagger?: boolean;
  domainMax?: number;
  onOpen: (r: Repo) => void;
  onWatch?: (r: Repo) => void;
  cursor?: boolean;
}

function isNew(repo: Repo): boolean {
  if (!repo.created_at) return false;
  return (Date.now() - new Date(repo.created_at).getTime()) / 86400000 <= 30;
}

export default function RepoRow({ repo, rank, board, window, watched, stagger = true, domainMax, onOpen, onWatch, cursor }: Props) {
  const delta = window === "1d" ? repo.stars_1d : window === "28d" ? repo.stars_28d : repo.stars_7d;
  const est = repo.velocity_est === 1;
  const winLabel = window === "1d" ? "近24h" : window === "28d" ? "近28天" : "近7日";
  const rankDelta = repo.prev_rank != null ? repo.prev_rank - rank : null;

  return (
    <motion.div
      className={`repo-row ${cursor ? "row-cursor" : ""} ${repo.cooling === 1 ? "cold-row" : ""}`}
      onClick={() => onOpen(repo)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(repo);
        }
      }}
      initial={stagger ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stagger ? Math.min(rank * 0.03, 0.5) : 0, duration: 0.35, ease: "easeOut" }}
    >
      <div className="rank-wrap">
        <div className={`rank ${rank === 1 ? "r1" : rank === 2 ? "r2" : rank === 3 ? "r3" : ""}`}>
          {rank}
        </div>
        {rankDelta != null && rankDelta !== 0 && (
          <div className={`rank-delta ${rankDelta > 0 ? "up" : "down"}`}>
            {rankDelta > 0 ? `↑${rankDelta}` : `↓${-rankDelta}`}
          </div>
        )}
      </div>

      <div className="repo-main">
        <div className="repo-name-line">
          <span className="repo-fullname">
            <span className="owner">{repo.owner}/</span>
            {repo.full_name.split("/")[1]}
          </span>
          {repo.resonance === 1 && (
            <span className="badge res" title="GitHub 与 Hacker News 同时起量">
              <Waves size={10} /> 共振{repo.hn_points ? ` ${repo.hn_points}pts` : ""}
            </span>
          )}
          {repo.black_horse === 1 && (
            <span className="badge fire">
              <Flame size={10} /> 黑马
            </span>
          )}
          {repo.cooling === 1 && (
            <span className="badge cold" title="曾上榜,近期增长停滞——只销户,不下架">
              <Snowflake size={10} /> 撤
            </span>
          )}
          {repo.marketing === 1 && (
            <span className="badge mkt" title="营销话术特征明显,资料量偏薄,谨慎参考">
              <TriangleAlert size={10} /> 营销嫌疑
            </span>
          )}
          {repo.owner_hot === 1 && (
            <span className="badge multi" title="同一作者多个项目同时上榜">同主多仓库</span>
          )}
          {repo.is_ai === 1 && <span className="badge ai">AI</span>}
          {isNew(repo) && <span className="badge new">新 · {fmtAge(repo.created_at)}</span>}
          {repo.language && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className="lang-dot" style={{ background: langColor(repo.language) }} />
              <span className="lang-name">{repo.language}</span>
            </span>
          )}
        </div>
        <div className="repo-desc">{repo.description || "暂无描述"}</div>
        {repo.commentary ? (
          <div className="repo-comment">
            <Sparkles size={12} className="spark-icon" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{repo.commentary}</span>
            {repo.commentary_why && <span className="why">— {repo.commentary_why}</span>}
          </div>
        ) : (
          <div className="comment-ghost">
            <Sparkles size={11} /> AI 点评待生成(可在设置中配置)
          </div>
        )}
      </div>

      <div className="spark-cell">
        <Sparkline spark={repo.spark} domainMax={domainMax} />
      </div>

      <div className="delta-cell">
        <div className={`delta-main ${est ? "est" : ""}`}>
          {est && "≈"}+{fmtNum(delta)}
        </div>
        <div className="delta-sub">
          {winLabel} · 今日 ≈+{fmtNum(repo.stars_1d)}
        </div>
      </div>

      <div className="stars-cell">
        <div className="stars-value">
          <Star size={13} fill="currentColor" />
          {fmtNum(repo.stars)}
        </div>
        <div className="stars-sub">
          {fmtNum(repo.forks)} forks
          {repo.commits_7d != null && ` · ${repo.commits_7d} commits/7d`}
        </div>
      </div>

      {onWatch && (
        <button
          className={`watch-btn ${watched ? "on" : ""}`}
          title={watched ? "取消关注" : "关注:里程碑与暴增推送"}
          onClick={(e) => {
            e.stopPropagation();
            onWatch(repo);
          }}
        >
          <Star size={14} fill={watched ? "currentColor" : "none"} />
        </button>
      )}
      <ChevronRight size={16} className="chev" />
    </motion.div>
  );
}
