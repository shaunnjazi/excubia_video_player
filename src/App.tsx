import { useState, useEffect } from 'react'
import AuthGate from './components/AuthGate'
import Sidebar from './components/Sidebar'
import Browser from './components/Browser'
import PlaylistSidebar from './components/PlaylistSidebar'
import { ToastContainer } from './components/ToastContainer'
import { ToastProvider } from './contexts/ToastContext'
import { getTemporaryLink } from './lib/dropbox'
import { addToPlaylist, addMultipleToPlaylist, nextVideo } from './services/playlist.service'
import { listFolder } from './lib/dropbox'

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [currentVideo, setCurrentVideo] = useState<{ path: string; name: string } | null>(null)
  const [view, setView] = useState<'browse' | 'recent'>('browse')
  const [currentPath, setCurrentPath] = useState('')
  const [showPlaylist, setShowPlaylist] = useState(false)

  const handleLogout = async () => {
    setAccessToken(null)
    setCurrentVideo(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('clear_stored_token')
    } catch {}
  }

  const playUrl = async (path: string, name: string) => {
    try {
      const link = await getTemporaryLink(accessToken!, path)
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('launch_mpv', { url: link })
      setCurrentVideo({ path, name })
    } catch (err: any) {
      console.error('Play failed:', err)
    }
  }

  const handlePlayVideo = async (path: string, name: string) => {
    // Add to playlist and play
    addToPlaylist({ path, name, added: Date.now() })
    await playUrl(path, name)
  }

  const handlePlayNext = async () => {
    if (!currentVideo) return
    const next = nextVideo(currentVideo.path)
    if (next) await handlePlayVideo(next.path, next.name)
  }

  const handleFolderPlay = async (folderPath: string, firstVideoPath: string, firstVideoName: string) => {
    // Load folder and add all videos to playlist
    try {
      const result = await listFolder(accessToken!, folderPath)
      const videos = result.entries
        .filter(e => e.tag === 'file' && e.name.match(/\.(mp4|mkv|avi|mov|webm|m4v|mpg|mpeg|wmv|flv|ts)$/i))
        .map(e => ({ path: e.path_lower, name: e.name, size: e.size, added: Date.now() }))
      addMultipleToPlaylist(videos)
      await playUrl(firstVideoPath, firstVideoName)
    } catch {}
  }

  useEffect(() => {
    if (view === 'browse' && currentPath) {
      // When navigating to a folder, populate playlist
      handleFolderPlay(currentPath, '', '')
    }
  }, [view])

  if (!accessToken) return (
    <ToastProvider>
      <AuthGate onToken={setAccessToken} />
      <ToastContainer />
    </ToastProvider>
  )

  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', background: '#0D1117' }}>
        <Sidebar
          view={view}
          onViewChange={setView}
          onLogout={handleLogout}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Browser
            accessToken={accessToken}
            view={view}
            currentPath={currentPath}
            onNavigate={(path) => {
              setCurrentPath(path)
              setView('browse')
            }}
            onPlayVideo={handlePlayVideo}
          />
          {currentVideo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px',
              background: '#161B22', borderTop: '1px solid #30363D', flexShrink: 0, }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#2F81F7">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span style={{ fontSize: '13px', color: '#E6EDF3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentVideo.name}
              </span>
              <button onClick={handlePlayNext} title="Next in playlist"
                style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z" />
                </svg>
              </button>
              <button onClick={() => setShowPlaylist(p => !p)} title="Playlist"
                style={{ background: showPlaylist ? '#2F81F722' : 'none', border: `1px solid ${showPlaylist ? '#2F81F7' : 'transparent'}`, color: '#8B949E', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <button onClick={() => setCurrentVideo(null)}
                style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {showPlaylist && (
          <PlaylistSidebar
            currentVideoPath={currentVideo?.path || null}
            onPlayVideo={handlePlayVideo}
            onClose={() => setShowPlaylist(false)}
            width={280}
          />
        )}
      </div>
      <ToastContainer />
    </ToastProvider>
  )
}
