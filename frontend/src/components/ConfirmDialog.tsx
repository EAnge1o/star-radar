interface Props {
  title: string;
  body: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ title, body, confirmText = "确认", danger, onConfirm, onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button
            className={danger ? "btn danger-ghost" : "btn primary"}
            style={danger ? { borderColor: "var(--red)" } : undefined}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
