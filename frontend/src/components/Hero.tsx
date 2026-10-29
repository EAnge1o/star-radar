import { Activity, Flame, Radio, Users } from "lucide-react";
import type { Stats } from "../types";
import { fmtNum } from "../utils";
import CountUp from "./CountUp";
import RadarSweep from "./RadarSweep";

export default function Hero({ stats }: { stats: Stats | null }) {
  return (
    <section className="hero wrap">
      <div>
        <span className="hero-kicker">GITHUB TRENDING RADAR · 每日自动观测</span>
        <h1 className="hero-title">
          看见开源世界的
          <br />
          <span className="grad">下一颗新星</span>
        </h1>
        <p className="hero-desc">
          StarRadar 持续扫描 GitHub,按「真实增速」而非总量排行:每日新秀、黑马爆发、
          热门赛道,以及每个项目的一句话中文点评 —— 技术选型前的第一站。
        </p>
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">
              <Radio size={12} /> 追踪仓库
            </div>
            <div className="kpi-value accent">
              <CountUp value={stats?.total_repos ?? 0} />
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Activity size={12} /> 今日新增 Star
            </div>
            <div className="kpi-value">
              +<CountUp value={stats?.today_new_stars ?? 0} format={(n) => fmtNum(n)} />
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Users size={12} /> 近30天新秀
            </div>
            <div className="kpi-value">
              <CountUp value={stats?.newcomers ?? 0} />
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Flame size={12} /> 黑马爆发
            </div>
            <div className="kpi-value" style={{ color: "var(--amber)" }}>
              <CountUp value={stats?.black_horses ?? 0} />
            </div>
          </div>
        </div>
      </div>
      <RadarSweep />
    </section>
  );
}
