import { Github, Radar, RefreshCw, Settings2 } from "lucide-react";
import { timeAgo } from "../utils";

interface Props {
  lastFetchAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onSettings: () => void;
}

export default function TopNav({ lastFetchAt, refreshing, onRefresh, onSettings }: Props) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a className="logo" href="#" onClick={(e) => e.preventDefault()}>
          <span className="logo-mark">
            <Radar size={17} strokeWidth={2.2} />
          </span>
          <span className="logo-name">
            Star<em>Radar</em>
          </span>
          <span className="logo-sub">开源趋势雷达</span>
        </a>
        <div className="nav-right">
          <span className="obs-at">
            <span className="obs-dot" />
            最近观测 {timeAgo(lastFetchAt)}
          </span>
          <button
            className={`icon-btn ${refreshing ? "spin" : ""}`}
            title="立即观测一轮"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={15} />
          </button>
          <button className="icon-btn" title="设置" onClick={onSettings}>
            <Settings2 size={15} />
          </button>
          <a
            className="icon-btn"
            title="项目地址"
            href="https://github.com/trending"
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
