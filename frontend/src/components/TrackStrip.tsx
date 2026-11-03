import type { Track } from "../types";
import { trackColor } from "../utils";

interface Props {
  tracks: Track[];
  activeTrackId: number;
  onSelect: (id: number) => void;
}

export default function TrackStrip({ tracks, activeTrackId, onSelect }: Props) {
  return (
    <div className="track-row">
      {tracks.map((t) => {
        const c = trackColor(t.id);
        const active = activeTrackId === t.id;
        return (
          <div
            key={t.id}
            className={`track-card ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? 0 : t.id)}
            title={t.repos.map((r) => r.full_name).join("\n")}
          >
            <div className="track-label">
              <span className="track-dot" style={{ background: c }} />
              {t.label}
            </div>
            <div className="track-summary">{t.summary || "—"}</div>
            <div className="track-meta">
              <span>{t.size} 个项目</span>
              <span style={{ color: active ? c : undefined }}>热度 {(t.heat * 100).toFixed(0)}</span>
            </div>
          </div>
        );
      })}
      {tracks.length === 0 && (
        <div style={{ color: "var(--faint)", fontSize: 12.5 }}>第一轮观测完成后,这里会显示赛道分布。</div>
      )}
    </div>
  );
}
