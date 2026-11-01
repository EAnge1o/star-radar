import { Bot, ListFilter, Search, Settings2 } from "lucide-react";
import type { Sub } from "../types";

export type BoardKind = "velocity" | "fresh" | "total" | "cooling" | "sub";
export type WindowKind = "1d" | "7d" | "28d";

interface Props {
  board: BoardKind;
  window: WindowKind;
  lang: string;
  q: string;
  aiOnly: boolean;
  languages: string[];
  subs: Sub[];
  subId: number;
  onBoard: (b: BoardKind) => void;
  onWindow: (w: WindowKind) => void;
  onLang: (l: string) => void;
  onQ: (q: string) => void;
  onAiOnly: (v: boolean) => void;
  onSub: (id: number) => void;
  onManageSubs: () => void;
}

export default function Controls(p: Props) {
  return (
    <div className="controls wrap" style={{ maxWidth: 1180 }}>
      <div className="seg">
        {(
          [
            ["velocity", "增速榜"],
            ["fresh", "新秀榜"],
            ["total", "总量榜"],
            ["cooling", "降温榜"],
          ] as [BoardKind, string][]
        ).map(([k, label]) => (
          <button key={k} className={p.board === k ? "on" : ""} onClick={() => p.onBoard(k)}>
            {label}
          </button>
        ))}
        {p.subs.map((s) => (
          <button
            key={"sub" + s.id}
            className={p.board === "sub" && p.subId === s.id ? "on" : ""}
            onClick={() => p.onSub(s.id)}
            title={`订阅:${s.query}`}
          >
            ★ {s.name}
          </button>
        ))}
        <button className="seg-manage" onClick={p.onManageSubs} title="管理关键词订阅">
          <Settings2 size={13} />
        </button>
      </div>

      {p.board === "velocity" && (
        <div className="seg">
          {(
            [
              ["1d", "今日"],
              ["7d", "本周"],
              ["28d", "本月"],
            ] as [WindowKind, string][]
          ).map(([k, label]) => (
            <button key={k} className={p.window === k ? "on" : ""} onClick={() => p.onWindow(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="search-box">
        <Search size={14} />
        <input
          id="board-search"
          placeholder="搜索项目 / 关键词 / 点评…(按 / 聚焦)"
          value={p.q}
          onChange={(e) => p.onQ(e.target.value)}
        />
      </div>

      <select className="select" value={p.lang} onChange={(e) => p.onLang(e.target.value)}>
        <option value="">全部语言</option>
        {p.languages.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <div className={`ai-toggle ${p.aiOnly ? "on" : ""}`} onClick={() => p.onAiOnly(!p.aiOnly)}>
        <Bot size={14} />
        仅 AI 相关
      </div>
    </div>
  );
}
