import { Radio } from "lucide-react";
import type { Stats } from "../types";
import { fmtInt, fmtNum, timeAgo } from "../utils";

export default function Hero({ stats }: { stats: Stats | null }) {
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  void today;

  return (
    <section className="hero">
      <div className="wrap masthead">
        <div>
          <div className="mast-date">{today} · MIDNIGHT TRANSIT DIAGRAM, COMPOSED DAILY</div>
          <h1 className="mast-title">
            今日 <em>{stats?.total_repos ?? 0}</em> 站在线路上,哪条线在提速?
          </h1>
          <p className="mast-line">
            每轮观测重画线网:赛道是线路,头部项目是站点,HN 共振画成换乘环。
            增速实测为准,标 ≈ 的是虚线区段(估算),配置 GITHUB_TOKEN 后升级为实测。
          </p>
          <div className="mast-meta">
            <span>线网更新 · {timeAgo(stats?.last_fetch?.finished_at)}</span>
            <span>j / k 移动 · Enter 展开 · / 搜索</span>
            {!!stats?.resonant && <span>换乘环 {stats.resonant} 处</span>}
          </div>
        </div>
        <div>
          <div className="lead-box">
            <div className="kpi-label">
              <Radio size={12} /> 报眼 · 今日新增 STAR
            </div>
            <div className="lead-num">
              +{fmtNum(stats?.today_new_stars ?? 0)}
              <small>/{fmtInt(stats?.total_repos ?? 0)} repos</small>
            </div>
          </div>
          <div className="mast-kpis" style={{ marginTop: 10 }}>
            <div className="kpi">
              <div className="kpi-label">近30天新秀</div>
              <div className="kpi-value accent">{fmtInt(stats?.newcomers ?? 0)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">黑马爆发</div>
              <div className="kpi-value" style={{ color: "var(--zhusha)" }}>{fmtInt(stats?.black_horses ?? 0)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">活跃赛道</div>
              <div className="kpi-value">{fmtInt(stats?.tracks ?? 0)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Watchlist</div>
              <div className="kpi-value">{fmtInt(stats?.watch_count ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
