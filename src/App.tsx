import { useState, useEffect, useCallback } from 'react'
import AuthGate from './components/AuthGate'
import Sidebar from './components/Sidebar'
import Browser from './components/Browser'
import PlaylistSidebar from './components/PlaylistSidebar'
import NowPlaying from './components/NowPlaying'
import { ToastContainer } from './components/ToastContainer'
import { ToastProvider } from './contexts/ToastContext'
import { getTemporaryLink } from './lib/dropbox'
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

  const playUrl = useCallback(async (path: string, name: string) => {
    try {
      const link = await getTemporaryLink(accessToken!, path)
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_mpv').catch(() => {})
      await invoke('mpv_loadfile', { url: link })
      setCurrentVideo({ path, name })
    } catch (err: any) {
      console.error('Play failed:', err)
    }
  }, [accessToken])

  const handlePlayVideo = useCallback(async (path: string, name: string) => {
    addToPlaylist({ path, name, added: Date.now() })
    await playUrl(path, name)
  }, [playUrl])

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
      await invoke('mpv_loadfile', { url: '' }).catch(() => {})
    } catch {}
    setCurrentVideo(null)
  }, [])

  // Pre-start mpv on mount so first load is instant
  useEffect(() => {
    ;(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('start_mpv')
      } catch {}
    })()
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
        <Sidebar view={view} onViewChange={setView} onLogout={handleLogout} />
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
            />
          ) : (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #30363D', fontSize: '12px', color: '#6E7681', textAlign: 'center', background: '#161B22' }}>
              {getPlaylist().length > 0 ? `${getPlaylist().length} videos in playlist — click one to play` : 'Select a video to play'}
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
