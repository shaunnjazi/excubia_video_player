import { useToast, type Toast } from '../contexts/ToastContext'

const ICONS: Record<string, React.ReactNode> = {
  error: <circle cx="12" cy="12" r="10" />,
  warning: <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
  success: <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />,
}

const COLORS: Record<string, string> = {
  error: '#F85149',
  warning: '#D29922',
  success: '#3FB950',
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '380px' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div style={{
      background: '#161B22', border: `1px solid ${COLORS[toast.type]}33`, borderRadius: '8px',
      padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', gap: '10px', animation: 'slideIn 0.2s ease',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS[toast.type]} strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
        {ICONS[toast.type]}
      </svg>
      <div style={{ flex: 1, fontSize: '13px', color: '#E6EDF3', lineHeight: '1.4' }}>
        {toast.message}
        {toast.actionLabel && toast.actionFn && (
          <button onClick={() => { toast.actionFn!(); onDismiss() }}
            style={{ display: 'block', marginTop: '8px', padding: '4px 12px', background: '#21262D',
              border: '1px solid #30363D', color: '#2F81F7', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  )
}
