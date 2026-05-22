import { useState } from 'react'
import AuthGate from './components/AuthGate'
import Sidebar from './components/Sidebar'
import Browser from './components/Browser'

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [currentVideo, setCurrentVideo] = useState<{
    path: string
    name: string
  } | null>(null)

  const handleLogout = async () => {
    setAccessToken(null)
    setCurrentVideo(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('clear_stored_token')
    } catch {}
  }

  if (!accessToken) return <AuthGate onToken={setAccessToken} />

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0D1117' }}>
        <Sidebar onLogout={handleLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Browser
          accessToken={accessToken}
          onPlayVideo={(path, name) => setCurrentVideo({ path, name })}
        />
        {/* Now Playing bar */}
        {currentVideo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 16px', background: '#161B22', borderTop: '1px solid #30363D',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#2F81F7">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span style={{ fontSize: '13px', color: '#E6EDF3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentVideo.name}
            </span>
            <button onClick={() => setCurrentVideo(null)} style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
