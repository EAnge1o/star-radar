import { useEffect, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../api";
import type { Sub } from "../types";

interface Props {
  onClose: () => void;
  onChange: () => void;
  notify: (msg: string) => void;
  confirm: (s: { title: string; body: string; danger?: boolean; confirmText?: string; action: () => void }) => void;
}

const EXAMPLES = [
  { name: "MCP 生态", query: "topic:mcp stars:>100" },
  { name: "Rust 新锐", query: "language:Rust created:>2026-10-01 stars:>50" },
  { name: "Agent 框架", query: "topic:ai-agents stars:>500" },
];

export default function SubsModal({ onClose, onChange, notify, confirm }: Props) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.subs.list().then((r) => setSubs(r.subs)).catch(() => {});
  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = async (n?: string, q?: string) => {
    const nm = (n ?? name).trim();
    const qr = (q ?? query).trim();
    if (!nm || !qr) return notify("名称和查询都填一下");
    setBusy(true);
    try {
      await api.subs.add(nm, qr);
      notify(`订阅「${nm}」已创建,下一轮观测(约几分钟)后出现在页签里`);
      setName("");
      setQuery("");
      load();
      onChange();
    } catch (e) {
      notify(`创建失败:${String(e).slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = (s: Sub) => {
    confirm({
      title: "删除订阅?",
      body: `「${s.name}」的页签与历史结果将一并移除。`,
      danger: true,
      confirmText: "删除",
      action: async () => {
        await api.subs.remove(s.id);
        notify(`已删除订阅「${s.name}」`);
        load();
        onChange();
      },
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose}><X size={15} /></button>
        <h3>关键词订阅</h3>
        <p className="hint">
          用 GitHub 搜索语法定义你自己的雷达,例如 <code>topic:mcp stars:&gt;100</code>。
          每轮观测会自动执行这些查询,结果以独立页签出现在榜单上方。
        </p>

        <div className="field">
          <label>页签名称</label>
          <input placeholder="如:MCP 生态" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>GITHUB 搜索语法</label>
          <input
            placeholder="topic:mcp stars:>100"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.name} className="chip" onClick={() => add(ex.name, ex.query)}>
              <Plus size={11} style={{ verticalAlign: -2 }} /> {ex.name}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => add()} disabled={busy}>
          <Search size={14} /> 创建订阅
        </button>

        {subs.length > 0 && (
          <div className="subs-list">
            {subs.map((s) => (
              <div key={s.id} className="subs-item">
                <div>
                  <div className="subs-name">★ {s.name}</div>
                  <div className="subs-query">{s.query}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="section-sub" style={{ fontFamily: "var(--font-mono)" }}>{s.results} 结果</span>
                  <button className="icon-btn" onClick={() => remove(s)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
