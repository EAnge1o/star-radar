import { Activity, FileText, Github, LayoutDashboard, Moon, Radar as RadarIcon, Rss, Settings2, Star, Sun, TrendingUp } from "lucide-react";

export type RouteName = "home" | "boards" | "watchlist" | "subs" | "report" | "agent";

interface Props {
  route: RouteName;
  watchCount: number;
  theme: "dark" | "light";
  open: boolean;
  onNavigate: (r: RouteName) => void;
  onTheme: () => void;
  onSettings: () => void;
  onClose: () => void;
}

const ITEMS: { key: RouteName; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "总览", icon: <LayoutDashboard size={16} /> },
  { key: "boards", label: "趋势榜", icon: <TrendingUp size={16} /> },
  { key: "watchlist", label: "Watchlist", icon: <Star size={16} /> },
  { key: "subs", label: "订阅", icon: <Rss size={16} /> },
  { key: "report", label: "报告", icon: <FileText size={16} /> },
  { key: "agent", label: "Agent 动态", icon: <Activity size={16} /> },
];

export default function Sidebar({ route, watchCount, theme, open, onNavigate, onTheme, onSettings, onClose }: Props) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <a className="side-logo" href="#/" onClick={(e) => { e.preventDefault(); onNavigate("home"); onClose(); }}>
        <span className="logo-tile"><RadarIcon size={16} /></span>
        <span>
          <span className="logo-word">StarRadar</span>
          <span className="logo-sub">GitHub 趋势观测</span>
        </span>
      </a>
      <nav className="side-nav">
        <div className="side-label">观测</div>
        {ITEMS.slice(0, 2).map((it) => (
          <NavBtn key={it.key} icon={it.icon} label={it.label}
            active={route === it.key}
            onClick={() => { onNavigate(it.key); onClose(); }} />
        ))}
        <div className="side-label">我的</div>
        {ITEMS.slice(2, 5).map((it) => (
          <NavBtn
            key={it.key}
            icon={it.icon}
            label={it.label}
            active={route === it.key}
            badge={it.key === "watchlist" && watchCount > 0 ? watchCount : undefined}
            onClick={() => { onNavigate(it.key); onClose(); }}
          />
        ))}
        <div className="side-label">系统</div>
        <NavBtn
          icon={<Activity size={16} />}
          label="Agent 动态"
          active={route === "agent"}
          onClick={() => { onNavigate("agent"); onClose(); }}
        />
      </nav>
      <div className="side-footer">
        <button className="side-item" onClick={onSettings}>
          <Settings2 size={16} /> 设置
        </button>
        <button className="side-item" onClick={onTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "明亮主题" : "深色主题"}
        </button>
        <a className="side-item" href="https://github.com/EAnge1o/star-radar" target="_blank" rel="noreferrer">
          <Github size={16} /> GitHub
        </a>
      </div>
    </aside>
  );
}

function NavBtn({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button className={`side-item ${active ? "on" : ""}`} onClick={onClick}>
      {icon}
      {label}
      {badge != null && (
        <span className="badge" style={{ marginLeft: "auto", background: "var(--primary)", color: "var(--primary-ink)", borderColor: "transparent" }}>
          {badge}
        </span>
      )}
    </button>
  );
}
