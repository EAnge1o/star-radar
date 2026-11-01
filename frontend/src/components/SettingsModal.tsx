import { useEffect, useState } from "react";
import { Bell, CheckCircle2, KeyRound, Loader2, Send, X, XCircle } from "lucide-react";
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

  const [feishu, setFeishu] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat] = useState("");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    api.settings().then((r) => {
      setFeishu(r.settings.feishu_webhook || "");
      setTgToken(r.settings.telegram_token || "");
      setTgChat(r.settings.telegram_chat || "");
    }).catch(() => {});
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
    notify("正在为缺失项目生成中文点评,约需 1-3 分钟…");
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

  const savePush = async () => {
    await api.setSettings({
      feishu_webhook: feishu.trim(),
      telegram_token: tgToken.trim(),
      telegram_chat: tgChat.trim(),
    });
    notify("推送通道配置已保存");
  };

  const testPush = async () => {
    setPushBusy(true);
    try {
      const r = await api.testNotify();
      const ok = Object.values(r.result || {}).some((v) => v === 200);
      notify(ok ? "测试通知已发出,去看看飞书/TG 收到没" : "已记入站内通知;外部通道未配置或失败");
    } catch (e) {
      notify(`测试失败:${String(e).slice(0, 80)}`);
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose}><X size={15} /></button>
        <h3>设置</h3>
        <p className="hint">
          配置智谱开放平台 API Key(open.bigmodel.cn 获取)后,雷达为每个项目生成中文点评、
          语义赛道与营销检测。Key 仅保存在当前服务进程内存,不落盘。
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <button className="btn primary" onClick={save} disabled={busy || !key.trim()}>
            {busy ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
            保存并测试
          </button>
          <button className="btn ghost" onClick={genComment} disabled={commentBusy || !stats?.llm_ready}>
            {commentBusy ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
            立即生成缺失点评
          </button>
        </div>
        {probe && (
          <div className={`probe-line ${probe.ok ? "probe-ok" : "probe-bad"}`}>
            {probe.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{probe.msg}
          </div>
        )}

        <div className="push-section">
          <div className="label"><Bell size={12} /> 推送通道(Watchlist 里程碑 / 暴增 / 简报)</div>
          <div className="field">
            <label>飞书群机器人 WEBHOOK</label>
            <input
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/…"
              value={feishu}
              onChange={(e) => setFeishu(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label>TELEGRAM BOT TOKEN</label>
              <input placeholder="123456:ABC-…" value={tgToken} onChange={(e) => setTgToken(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>TELEGRAM CHAT ID</label>
              <input placeholder="如 123456789" value={tgChat} onChange={(e) => setTgChat(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" onClick={savePush}><KeyRound size={14} /> 保存通道</button>
            <button className="btn ghost" onClick={testPush} disabled={pushBusy}>
              {pushBusy ? <Loader2 size={14} className="spin" /> : <Send size={14} />} 发送测试通知
            </button>
          </div>
          <div className="probe-line" style={{ color: "var(--faint)" }}>
            不配外部通道也行:站内通知 + 浏览器桌面通知始终可用。
          </div>
        </div>

        <div className="probe-line" style={{ color: "var(--faint)", marginTop: 14 }}>
          GitHub Token:{stats?.github_token ? "已配置(精确增速采样已启用)" : "未配置(增速为年龄估算,标注 ≈)"}
        </div>
        <div className="probe-line" style={{ color: "var(--faint)" }}>
          LLM:{stats?.llm_ready ? `已就绪(${stats.llm_model})` : "未配置"}
        </div>
      </div>
    </div>
  );
}
