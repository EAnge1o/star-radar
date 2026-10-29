import { motion } from "framer-motion";
import type { Track } from "../types";

interface Props {
  tracks: Track[];
  activeTrackId: number;
  onSelect: (id: number) => void;
}

export default function TrackStrip({ tracks, activeTrackId, onSelect }: Props) {
  return (
    <section className="section wrap">
      <div className="section-head">
        <h2 className="section-title">
          <span className="live" />
          实时赛道
        </h2>
        <span className="section-sub">
          语义聚类本周新锐项目 · 热度 = 赛道内近 7 日 Star 占比
        </span>
      </div>
      <div className="tracks">
        {tracks.map((t, i) => (
          <motion.div
            key={t.id}
            className={`track-card ${activeTrackId === t.id ? "active" : ""}`}
            onClick={() => onSelect(activeTrackId === t.id ? 0 : t.id)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
            title={t.repos.map((r) => r.full_name).join("\n")}
          >
            <div className="track-label">{t.label}</div>
            <div className="track-summary">{t.summary || "—"}</div>
            <div className="track-meta">
              <span>{t.size} 个项目</span>
              <span>热度 {(t.heat * 100).toFixed(0)}</span>
            </div>
            <div className="heat-bar">
              <div className="heat-fill" style={{ width: `${Math.max(6, t.heat * 100)}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
