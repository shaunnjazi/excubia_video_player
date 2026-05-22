interface SidebarProps {
  onLogout: () => void
}

export default function Sidebar({ onLogout }: SidebarProps) {
  return (
    <div
      style={{
        width: '200px',
        background: '#161B22',
        borderRight: '1px solid #30363D',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#E6EDF3', margin: '0 0 16px 12px' }}>
        Excubia
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#21262D', borderRadius: '6px', fontSize: '13px', color: '#E6EDF3' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        Browse Files
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: 'transparent', border: 'none', color: '#8B949E', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', textAlign: 'left', width: '100%',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Disconnect
      </button>
    </div>
  )
}
