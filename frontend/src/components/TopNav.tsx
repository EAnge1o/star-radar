import { Github, Moon, Newspaper, Radar, RefreshCw, Rows3, Settings2, Star, Sun } from "lucide-react";
import { timeAgo } from "../utils";

interface Props {
  lastFetchAt: string | null;
  refreshing: boolean;
  watchCount: number;
  theme: "dark" | "light";
  density: "cozy" | "compact";
  onRefresh: () => void;
  onSettings: () => void;
  onWatchlist: () => void;
  onReport: () => void;
  onTheme: () => void;
  onDensity: () => void;
}

export default function TopNav(p: Props) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a className="logo" href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = "#/"; }}>
          <span className="logo-mark">
            <Radar size={17} strokeWidth={2.2} />
          </span>
          <span className="logo-name">
            Star<em>Radar</em>
          </span>
          <span className="logo-sub">GitHub 趋势雷达</span>
        </a>
        <div className="nav-right">
          <span className="obs-at">
            <span className="obs-dot" />
            最近观测 {timeAgo(p.lastFetchAt)}
          </span>
          <button className="icon-btn" title="Watchlist(关注与推送)" onClick={p.onWatchlist}>
            <Star size={15} />
            {p.watchCount > 0 && <span className="nav-badge">{p.watchCount}</span>}
          </button>
          <button className="icon-btn" title="每日 / 每周报告" onClick={p.onReport}>
            <Newspaper size={15} />
          </button>
          <button
            className={`icon-btn ${p.refreshing ? "spin" : ""}`}
            title="立即观测一轮"
            onClick={p.onRefresh}
            disabled={p.refreshing}
          >
            <RefreshCw size={15} />
          </button>
          <button
            className="icon-btn"
            title={p.theme === "dark" ? "切换到明亮主题" : "切换到深色主题"}
            onClick={p.onTheme}
          >
            {p.theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className="icon-btn"
            title={p.density === "cozy" ? "切换紧凑密度" : "切换宽松密度"}
            onClick={p.onDensity}
          >
            <Rows3 size={15} />
          </button>
          <button className="icon-btn" title="设置" onClick={p.onSettings}>
            <Settings2 size={15} />
          </button>
          <a
            className="icon-btn"
            title="GitHub"
            href="https://github.com/EAnge1o/star-radar"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={15} />
          </a>
        </div>
      </div>
    </header>
  );
}
