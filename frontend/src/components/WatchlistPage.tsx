import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api } from "../api";
import type { Repo } from "../types";
import { fmtNum } from "../utils";
import RepoRow from "./RepoRow";

interface Props {
  onOpen: (r: Repo) => void;
  onWatchChange: () => void;
  notify: (msg: string) => void;
  confirm: (s: { title: string; body: string; danger?: boolean; confirmText?: string; action: () => void }) => void;
}

export default function WatchlistPage({ onOpen, onWatchChange, notify, confirm }: Props) {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [notifications, setNotifications] = useState<import("../types").Notification[]>([]);

  const load = () => {
    api.watch.list().then((r) => setRepos(r.repos)).catch(() => setRepos([]));
    api.notifications(0).then((r) => setNotifications(r.notifications)).catch(() => {});
  };
  useEffect(load, []);

  const unwatch = (r: Repo) => {
    confirm({
      title: "取消关注?",
      body: `将不再推送 ${r.full_name} 的里程碑与暴增通知。`,
      danger: true,
      confirmText: "取消关注",
      action: async () => {
        await api.watch.remove(r.gh_id);
        notify(`已取消关注 ${r.full_name}`);
        load();
        onWatchChange();
      },
    });
  };

  const askDesktop = async () => {
    if (!("Notification" in window)) return notify("此浏览器不支持桌面通知");
    const p = await Notification.requestPermission();
    notify(p === "granted" ? "桌面通知已开启:里程碑达成时会弹窗提醒" : "桌面通知被拒绝");
  };

  return (
    <div className="page wrap">
      <div className="page-head">
        <h1>Watchlist</h1>
        <p className="sub">里程碑(破 1k / 5k / 10k…)与单日暴增会推送到已配置的通道;桌面通知点右上角开启。</p>
        <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={askDesktop}>
          <Bell size={13} /> 开启桌面通知
        </button>
      </div>

      {notifications.length > 0 && (
        <div className="notif-box">
          <div className="label">最近通知</div>
          {notifications.slice(0, 8).map((n) => (
            <div key={n.id} className="notif-item">
              <span className={`notif-kind ${n.kind}`}>{n.kind}</span>
              <span className="notif-title">{n.title}</span>
              <span className="notif-time">{n.created_at.slice(5, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>
      )}

      {repos === null && Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel" />)}
      {repos?.length === 0 && (
        <div className="empty-state">
          <div className="big">还没有关注的项目</div>
          <div>在榜单里点项目右侧的 ☆,里程碑和暴增就会盯上它。</div>
        </div>
      )}
      <div className="repo-list">
        {repos?.map((r, i) => (
          <div key={r.gh_id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
            <RepoRow repo={r} rank={i + 1} board="watch" window="7d" stagger={false} watched onOpen={onOpen} />
            <button className="icon-btn" title="取消关注" onClick={() => unwatch(r)}>
              <BellOff size={14} />
            </button>
          </div>
        ))}
      </div>

      {repos && repos.length > 0 && (
        <div className="watch-stats" style={{ marginTop: 18, color: "var(--faint)", fontSize: 12.5 }}>
          共关注 {repos.length} 个项目 · 合计 {fmtNum(repos.reduce((s, r) => s + r.stars, 0))} stars ·
          近7日合计 ≈+{fmtNum(repos.reduce((s, r) => s + (r.stars_7d || 0), 0))}
        </div>
      )}
    </div>
  );
}
