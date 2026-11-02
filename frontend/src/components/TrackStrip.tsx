import { motion } from "framer-motion";
import type { Track } from "../types";
import { trackColor } from "../utils";

interface Props {
  tracks: Track[];
  activeTrackId: number;
  onSelect: (id: number) => void;
}

/** 线路小样:一段 45° 折线 + 三个站,颜色即该赛道在线网中的线路色。 */
function LineTick({ color }: { color: string }) {
  return (
    <div className="track-line">
      <svg width="120" height="16" viewBox="0 0 120 16" aria-hidden="true">
        <polyline
          points="0,8 28,8 34,2 90,2 96,8 120,8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="14" cy="8" r="3.2" fill="var(--bg0)" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="62" cy="2" r="3.2" fill="var(--bg0)" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="108" cy="8" r="3.2" fill="var(--bg0)" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export default function TrackStrip({ tracks, activeTrackId, onSelect }: Props) {
  return (
    <section className="section wrap">
      <div className="section-head">
        <h2 className="section-title">
          <span className="live" />
          线网总览
        </h2>
        <span className="section-sub">
          赛道即线路 · 热度为线路内近 7 日 Star 占比 · 点击进入线路
        </span>
      </div>
      <div className="tracks">
        {tracks.map((t, i) => {
          const c = trackColor(t.id);
          const active = activeTrackId === t.id;
          return (
            <motion.div
              key={t.id}
              className={`track-card ${active ? "active" : ""}`}
              style={active ? { borderColor: c, boxShadow: `inset 0 0 0 1px ${c}` } : undefined}
              onClick={() => onSelect(active ? 0 : t.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: "easeOut" }}
              title={t.repos.map((r) => r.full_name).join("\n")}
            >
              <LineTick color={c} />
              <div className="track-label">{t.label}</div>
              <div className="track-summary">{t.summary || "—"}</div>
              <div className="track-meta">
                <span>{t.size} 个项目</span>
                <span style={{ color: active ? c : undefined }}>热度 {(t.heat * 100).toFixed(0)}</span>
              </div>
              <div className="heat-bar">
                <div className="heat-fill" style={{ width: `${Math.max(6, t.heat * 100)}%`, background: c }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
