import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Copy, Send, Snowflake, Users } from "lucide-react";
import { api } from "../api";
import type { Report, ReportSection } from "../types";
import { fmtNum } from "../utils";

interface Props {
  kind: "daily" | "weekly";
  onBack: () => void;
  notify: (msg: string) => void;
}

export default function ReportPage({ kind, onBack, notify }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState(false);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    setReport(null);
    api.report(kind).then(setReport).catch(() => setErr(true));
  }, [kind]);

  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => notify("报告链接已复制,发给朋友吧"),
      () => notify("复制失败")
    );
  };

  const push = async () => {
    setPushing(true);
    try {
      await api.reportPush(kind);
      notify("已推送到配置的通道(飞书/Telegram),站内通知同时更新");
    } catch (e) {
      notify(`推送失败:${String(e).slice(0, 80)}`);
    } finally {
      setPushing(false);
    }
  };

  if (err)
    return (
      <div className="page wrap">
        <div className="empty-state"><div className="big">报告生成失败</div></div>
      </div>
    );
  if (!report)
    return <div className="wrap page">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" />)}</div>;

  return (
    <div className="page wrap report-page">
      <button className="btn ghost back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> 返回
      </button>

      <div className="report-hero">
        <div className="hero-kicker">
          {kind === "daily" ? "DAILY DIGEST · 每日简报" : "WEEKLY REPORT · 每周报告"}
        </div>
        <h1 className="hero-title" style={{ fontSize: 34 }}>
          {kind === "daily" ? "今日 GitHub" : "本周 GitHub"}
        </h1>
        <p className="report-intro">{report.intro}</p>
        <div className="report-actions">
          <button className="btn ghost" onClick={share}><Copy size={13} /> 复制链接</button>
          <button className="btn primary" onClick={push} disabled={pushing}>
            <Send size={13} /> {pushing ? "推送中…" : "推送到我的通道"}
          </button>
        </div>
        <div className="section-sub" style={{ marginTop: 10, fontFamily: "var(--font-mono)" }}>
          生成于 {report.generated_at.slice(0, 16).replace("T", " ")} UTC · 观测窗口 {report.window_days} 天
        </div>
      </div>

      <Section title="涨幅领先" sub="窗口期内真实新增 Star Top 10">
        {report.movers.map((m, i) => <Row key={m.full_name} r={m} idx={i + 1} gain={`+${fmtNum(m.gained)}`} />)}
      </Section>

      {report.newcomers.length > 0 && (
        <Section title="新面孔" sub="本窗口期首次被雷达发现的项目" icon={<Users size={13} />}>
          {report.newcomers.map((m, i) => <Row key={m.full_name} r={m} idx={i + 1} gain={m.stars ? `${fmtNum(m.stars)} ★` : ""} />)}
        </Section>
      )}

      {report.tracks_up.length > 0 && (
        <Section title="赛道升温" sub="热度环比上升的赛道">
          <div className="track-delta-grid">
            {report.tracks_up.map((t) => (
              <div key={t.label} className="track-delta up">
                <ArrowUpRight size={15} />
                <div>
                  <div className="td-label">{t.label}</div>
                  <div className="td-sub">热度 {(t.heat * 100).toFixed(0)} · +{(t.delta * 100).toFixed(1)}</div>
                </div>
              </div>
            ))}
            {report.tracks_down.map((t) => (
              <div key={t.label} className="track-delta down">
                <ArrowDownRight size={15} />
                <div>
                  <div className="td-label">{t.label}</div>
                  <div className="td-sub">热度 {(t.heat * 100).toFixed(0)} · {(t.delta * 100).toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.cooling.length > 0 && (
        <Section title="降温观察" sub="曾上榜、近期增长停滞的项目" icon={<Snowflake size={13} />}>
          {report.cooling.map((m, i) => <Row key={m.full_name} r={m} idx={i + 1} gain={`${fmtNum(m.stars)} ★`} cold />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, sub, icon, children }: { title: string; sub: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <div className="section-head">
        <h2 className="section-title" style={{ fontSize: 17 }}>{icon}{title}</h2>
        <span className="section-sub">{sub}</span>
      </div>
      {children}
    </section>
  );
}

function Row({ r, idx, gain, cold }: { r: ReportSection; idx: number; gain: string; cold?: boolean }) {
  return (
    <div className={`report-row ${cold ? "cold" : ""}`}>
      <div className="rank">{idx}</div>
      <div className="repo-main" style={{ minWidth: 0 }}>
        <div className="repo-fullname">
          <span className="owner">{r.full_name.split("/")[0]}/</span>
          {r.full_name.split("/")[1]}
          {r.is_ai === 1 && <span className="badge ai" style={{ marginLeft: 8 }}>AI</span>}
          {r.black_horse === 1 && <span className="badge fire" style={{ marginLeft: 8 }}>黑马</span>}
        </div>
        <div className="repo-desc">{r.description || r.commentary || "—"}</div>
      </div>
      <div className={`report-gain ${cold ? "" : "up"}`}>{gain}</div>
    </div>
  );
}
