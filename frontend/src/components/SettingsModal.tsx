import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Wand2, X, XCircle } from "lucide-react";
import { api } from "../api";
import type { Stats } from "../types";

interface Props {
  stats: Stats | null;
  onClose: () => void;
  onConfigured: () => void;
  notify: (msg: string) => void;
}

export default function SettingsModal({ stats, onClose, onConfigured, notify }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ ok: boolean; msg: string } | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      const r = await api.llmEnable(key.trim());
      if (r.probe.llm) {
        setProbe({ ok: true, msg: `连接成功,模型 ${r.probe.model}` });
        onConfigured();
      } else {
        setProbe({ ok: false, msg: r.probe.error || "连接失败,请检查 key" });
      }
    } catch (e) {
      setProbe({ ok: false, msg: String(e).slice(0, 120) });
    } finally {
      setBusy(false);
    }
  };

  const genComment = async () => {
    setCommentBusy(true);
    notify("正在为缺失项目生成中文点评,约需 1-2 分钟…");
    try {
      await api.llmComment();
      notify("点评生成完成");
      onConfigured();
    } catch (e) {
      notify(`生成失败:${String(e).slice(0, 80)}`);
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose}>
          <X size={15} />
        </button>
        <h3>设置</h3>
        <p className="hint">
          配置智谱开放平台 API Key(open.bigmodel.cn 获取)后,雷达会为每个项目生成
          「一句话中文点评 + 走向研判」,并对赛道做语义聚类重排。Key 仅保存在当前服务进程内存,不落盘。
        </p>

        <div className="field">
          <label>ZHIPU API KEY</label>
          <input
            type="password"
            placeholder="粘贴你的 API Key…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
            {busy ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
            保存并测试
          </button>
          <button
            className="btn ghost"
            onClick={genComment}
            disabled={commentBusy || !stats?.llm_ready}
            title={stats?.llm_ready ? "" : "先配置 API Key"}
          >
            {commentBusy ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
            立即生成缺失点评
          </button>
        </div>

        {probe && (
          <div className={`probe-line ${probe.ok ? "probe-ok" : "probe-bad"}`}>
            {probe.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {probe.msg}
          </div>
        )}

        <div className="probe-line" style={{ color: "var(--faint)", marginTop: 18 }}>
          GitHub Token:{stats?.github_token ? "已配置(精确增速采样已启用)" : "未配置(增速为年龄估算,标注 ≈)"}
        </div>
        <div className="probe-line" style={{ color: "var(--faint)" }}>
          LLM:{stats?.llm_ready ? `已就绪(${stats.llm_model})` : "未配置"}
        </div>
      </div>
    </div>
  );
}
