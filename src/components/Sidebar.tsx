interface SidebarProps {
  view: 'browse' | 'recent'
  onViewChange: (view: 'browse' | 'recent') => void
  onLogout: () => void
}

export default function Sidebar({ view, onViewChange, onLogout }: SidebarProps) {
  return (
    <div style={{ width: '220px', background: '#161B22', borderRight: '1px solid #30363D', display: 'flex', flexDirection: 'column', padding: '12px', flexShrink: 0 }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#E6EDF3', margin: '0 0 20px 12px' }}>
        Excubia
      </h2>

      <button onClick={() => onViewChange('browse')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: view === 'browse' ? '#21262D' : 'transparent', border: 'none',
          color: view === 'browse' ? '#E6EDF3' : '#8B949E', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', textAlign: 'left', width: '100%', marginBottom: '4px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        Browse Files
      </button>

      <button onClick={() => onViewChange('recent')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: view === 'recent' ? '#21262D' : 'transparent', border: 'none',
          color: view === 'recent' ? '#E6EDF3' : '#8B949E', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', textAlign: 'left', width: '100%', marginBottom: '4px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        Recent
      </button>

      <div style={{ flex: 1 }} />
      <button onClick={onLogout}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
          background: 'transparent', border: 'none', color: '#8B949E', borderRadius: '6px',
          cursor: 'pointer', fontSize: '13px', textAlign: 'left', width: '100%' }}>
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
