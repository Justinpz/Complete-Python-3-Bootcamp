import { useEffect } from 'react';
import { useStore } from '../store/store.js';
import { XIcon } from './icons.jsx';

function ToastCard({ toast }) {
  const dismissToast = useStore((s) => s.dismissToast);
  const undoCompletion = useStore((s) => s.undoCompletion);

  useEffect(() => {
    const t = setTimeout(() => dismissToast(toast.id), toast.kind === 'error' ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast.id, toast.kind, dismissToast]);

  return (
    <div className={`toast toast-${toast.kind || 'info'}`}>
      <div className="toast-body">
        <div className="toast-text">{toast.text}</div>
        {toast.sub ? <div className="toast-sub">{toast.sub}</div> : null}
      </div>
      {toast.undoEntryId ? (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            undoCompletion(toast.undoEntryId);
            dismissToast(toast.id);
          }}
        >
          UNDO
        </button>
      ) : null}
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
        <XIcon size={14} />
      </button>
    </div>
  );
}

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
