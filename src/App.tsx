import { useState, useCallback } from 'react'
import AuthGate from './components/AuthGate'
import Sidebar from './components/Sidebar'
import Browser from './components/Browser'
import PlaylistSidebar from './components/PlaylistSidebar'
import NowPlaying from './components/NowPlaying'
import { ToastContainer } from './components/ToastContainer'
import { ToastProvider } from './contexts/ToastContext'
import { addToPlaylist, nextVideo, getPlaylist } from './services/playlist.service'

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
      await invoke('mpv_stop').catch(() => {})
    } catch {}
  }

  const handlePlayVideo = useCallback(async (path: string, name: string) => {
    try {
      const { getTemporaryLink, listFolder } = await import('./lib/dropbox')
      const { invoke } = await import('@tauri-apps/api/core')
      const link = await getTemporaryLink(accessToken!, path)
      await invoke('start_mpv', { url: link })
      addToPlaylist({ path, name, added: Date.now() })
      setCurrentVideo({ path, name })
      // Auto-populate playlist with all videos in the same folder
      const folder = path.substring(0, path.lastIndexOf('/'))
      try {
        const result = await listFolder(accessToken!, folder)
        const videos = result.entries
          .filter(e => e.tag === 'file' && e.name.match(/\.(mp4|mkv|avi|mov|webm|m4v|mpg|mpeg|wmv|flv|ts)$/i))
          .map(e => ({ path: e.path_lower, name: e.name, size: e.size, added: Date.now() }))
        for (const v of videos) {
          if (v.path !== path) addToPlaylist(v)
        }
      } catch {}
    } catch (err: any) {
      console.error('Play failed:', err)
    }
  }, [accessToken])

  const getNextVideoName = (): string | undefined => {
    if (!currentVideo) return undefined
    const next = nextVideo(currentVideo.path)
    return next?.name
  }

  const handlePlayNext = useCallback(async () => {
    if (!currentVideo) return
    const next = nextVideo(currentVideo.path)
    if (next) await handlePlayVideo(next.path, next.name)
  }, [currentVideo, handlePlayVideo])

  const handlePlayPrev = useCallback(async () => {
    if (!currentVideo) return
    const list = getPlaylist()
    const idx = list.findIndex(p => p.path === currentVideo.path)
    if (idx > 0) {
      const prev = list[idx - 1]
      await handlePlayVideo(prev.path, prev.name)
    }
  }, [currentVideo, handlePlayVideo])

  const handleStop = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mpv_stop').catch(() => {})
    } catch {}
    setCurrentVideo(null)
  }, [])

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
          accessToken={accessToken}
          view={view}
          playlistCount={getPlaylist().length}
          onViewChange={setView}
          currentPath={currentPath}
          onNavigate={(path) => { setCurrentPath(path); setView('browse') }}
          onPlayVideo={handlePlayVideo}
          onTogglePlaylist={() => setShowPlaylist(p => !p)}
          onLogout={handleLogout}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Browser
            accessToken={accessToken}
            view={view}
            currentPath={currentPath}
            onNavigate={(path) => { setCurrentPath(path); setView('browse') }}
            onPlayVideo={handlePlayVideo}
          />
          {currentVideo ? (
            <NowPlaying
              videoName={currentVideo.name}
              onNext={handlePlayNext}
              onPrev={handlePlayPrev}
              onStop={handleStop}
              onTogglePlaylist={() => setShowPlaylist(p => !p)}
              playlistCount={getPlaylist().length}
              nextVideoName={getNextVideoName()}
            />
          ) : (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #30363D', fontSize: '12px', color: '#6E7681', display: 'flex', alignItems: 'center', gap: '8px', background: '#161B22' }}>
              <span style={{ flex: 1, textAlign: 'center' }}>
                {getPlaylist().length > 0 ? `${getPlaylist().length} videos in playlist` : 'Select a video to play'}
              </span>
              {getPlaylist().length > 0 && (
                <button onClick={() => setShowPlaylist(p => !p)} title="Playlist"
                  style={{ background: showPlaylist ? '#2F81F722' : 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              )}
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
