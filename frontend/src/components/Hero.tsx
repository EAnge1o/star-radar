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

  return (
    <section className="hero">
      <div className="wrap masthead">
        <div>
          <div className="mast-date">{today} · MIDNIGHT TRANSIT DIAGRAM · REDRAWN EVERY SIX HOURS</div>
          <h1 className="mast-title">
            线网今日重绘,提速的在<em>这几条</em>
          </h1>
          <p className="mast-line">
            全网 {fmtInt(stats?.total_repos ?? 0)} 个项目、{stats?.tracks ?? 0} 条线路在册。
            赛道为线路,头部项目为站点,与 Hacker News 同时起量者,以换乘环标注;
            增速均为实测,标 ≈ 者为估算。
          </p>
          <div className="mast-meta">
            <span>最近重绘 · {timeAgo(stats?.last_fetch?.finished_at)}</span>
            <span>j / k 移动 · Enter 展开 · / 搜索</span>
            {!!stats?.resonant && <span>换乘环 {stats.resonant} 处</span>}
          </div>
        </div>
        <div>
          <div className="lead-box">
            <div className="kpi-label">
              <Radio size={12} /> 今日首发 · 全网新增 STAR
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
