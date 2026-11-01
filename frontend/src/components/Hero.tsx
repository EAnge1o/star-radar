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
          <div className="mast-date">{today} · GITHUB TRENDING, COMPOSED DAILY</div>
          <h1 className="mast-title">
            今日拣字 <em>{stats?.total_repos ?? 0}</em> 项,涨落皆有其时
          </h1>
          <p className="mast-line">
            每轮观测重新拣选 GitHub 上正在起量的项目:增速实测为准,黑马以朱砂记之,
            赛道各有其盘。标 ≈ 的数字是估算,配置 GITHUB_TOKEN 后自动升级为实测。
          </p>
          <div className="mast-meta">
            <span>重新排字 · {timeAgo(stats?.last_fetch?.finished_at)}</span>
            <span>j / k 移动 · Enter 展开 · / 搜索</span>
            {!!stats?.resonant && <span>双平台共振 {stats.resonant} 项</span>}
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
