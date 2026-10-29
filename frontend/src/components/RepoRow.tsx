import { ChevronRight, Flame, Sparkles, Star } from "lucide-react";
import { motion } from "framer-motion";
import type { Repo } from "../types";
import { fmtAge, fmtNum, langColor } from "../utils";
import Sparkline from "./Sparkline";

interface Props {
  repo: Repo;
  rank: number;
  board: string;
  window: string;
  onOpen: (r: Repo) => void;
}

function isNew(repo: Repo): boolean {
  if (!repo.created_at) return false;
  return (Date.now() - new Date(repo.created_at).getTime()) / 86400000 <= 30;
}

export default function RepoRow({ repo, rank, board, window, onOpen }: Props) {
  const delta = window === "1d" ? repo.stars_1d : window === "28d" ? repo.stars_28d : repo.stars_7d;
  const est = repo.velocity_est === 1;
  const winLabel = window === "1d" ? "近24h" : window === "28d" ? "近28天" : "近7日";

  return (
    <motion.div
      className="repo-row"
      onClick={() => onOpen(repo)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.5), duration: 0.35, ease: "easeOut" }}
    >
      <div className={`rank ${rank === 1 ? "r1" : rank === 2 ? "r2" : rank === 3 ? "r3" : ""}`}>
        {rank}
      </div>

      <div className="repo-main">
        <div className="repo-name-line">
          <span className="repo-fullname">
            <span className="owner">{repo.owner}/</span>
            {repo.full_name.split("/")[1]}
          </span>
          {repo.black_horse === 1 && (
            <span className="badge fire">
              <Flame size={10} /> 黑马
            </span>
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
        <Sparkline spark={repo.spark} />
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
        <div className="stars-sub">{fmtNum(repo.forks)} forks</div>
      </div>

      <ChevronRight size={16} className="chev" />
    </motion.div>
  );
}
