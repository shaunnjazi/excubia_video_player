import { useState, useEffect, useRef, useCallback } from 'react'

interface NowPlayingProps {
  videoName: string
  onNext?: () => void
  onPrev?: () => void
  onStop: () => void
  onTogglePlaylist?: () => void
  playlistCount?: number
  nextVideoName?: string
}

export default function NowPlaying({ videoName, onNext, onPrev, onStop, onTogglePlaylist, playlistCount, nextVideoName }: NowPlayingProps) {
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(false)
  const [volume, setVolume] = useState(() => {
    try { return parseInt(localStorage.getItem('excubia_volume') || '100') } catch { return 100 }
  })
  const [muted, setMuted] = useState(false)
  const polling = useRef<ReturnType<typeof setInterval>>()

  // Poll mpv for playback state
  useEffect(() => {
    const poll = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const timeResp = await invoke<string>('mpv_get_property', { name: 'time-pos' }).catch(() => '0')
        const durResp = await invoke<string>('mpv_get_property', { name: 'duration' }).catch(() => '0')
        const pauseResp = await invoke<string>('mpv_get_property', { name: 'pause' }).catch(() => 'yes')
        try { setTime(parseFloat(JSON.parse(timeResp).data || '0')) } catch {}
        try { setDuration(parseFloat(JSON.parse(durResp).data || '0')) } catch {}
        setPaused(JSON.parse(pauseResp).data === true)
      } catch {}
    }
    poll()
    polling.current = setInterval(poll, 1000)
    return () => { if (polling.current) clearInterval(polling.current) }
  }, [])

  const sendCmd = useCallback(async (cmd: string, args: string[]) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      if (cmd === 'set') {
        await invoke('mpv_set_property', { name: args[0], value: args[1] })
      }
    } catch {}
  }, [])

  const togglePlay = () => sendCmd('set', ['pause', paused ? 'no' : 'yes'])
  const changeVolume = (v: number) => {
    setVolume(v)
    localStorage.setItem('excubia_volume', String(v))
    sendCmd('set', ['volume', String(v)])
  }
  const toggleMute = () => {
    setMuted(m => !m)
    sendCmd('set', ['mute', muted ? 'no' : 'yes'])
  }

  // Keyboard shortcuts
  useEffect(() => {
    const sendOsd = async (text: string) => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('mpv_command', { cmd: ['show-text', text, '3000'] })
      } catch {}
    }
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault(); togglePlay(); break
        case 'm':
          toggleMute(); break
        case 'n':
        case 'N':
          if (onNext) { onNext(); sendOsd(nextVideoName ? `Next: ${nextVideoName}` : 'Next') }
          break
        case 'b':
        case 'B':
          if (onPrev) { onPrev(); sendOsd('Previous') }
          break
        case 'ArrowLeft':
          seekCmd(Math.max(0, time - 10)); break
        case 'ArrowRight':
          seekCmd(Math.min(duration, time + 10)); break
        case 'ArrowUp':
          changeVolume(Math.min(100, volume + 10)); break
        case 'ArrowDown':
          changeVolume(Math.max(0, volume - 10)); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [time, duration, volume, onNext, onPrev, nextVideoName])

  const seekCmd = async (t: number) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('mpv_command', { cmd: ['seek', String(t), 'absolute'] })
    } catch {}
  }

  const fmtTime = (t: number) => {
    if (!isFinite(t)) return '0:00'
    const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = Math.floor(t % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div style={{ background: '#161B22', borderTop: '1px solid #30363D', display: 'flex', flexDirection: 'column' }}>
      {/* Progress bar */}
      {duration > 0 && (
        <div style={{ height: '3px', background: '#30363D', position: 'relative' }}>
          <div style={{ height: '100%', width: `${(time / duration) * 100}%`, background: '#2F81F7', transition: 'width 0.3s' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
        {/* Thumbnail area */}
        <div style={{ width: '40px', height: '24px', background: '#0D1117', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#2F81F7"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        </div>

        {/* Video info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
            {videoName}
          </div>
          <div style={{ fontSize: '11px', color: '#6E7681', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTime(time)} / {fmtTime(duration)}
          </div>
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {onPrev && (
            <button onClick={onPrev} title="Previous" style={btnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z"/></svg>
            </button>
          )}
          <button onClick={togglePlay} title={paused ? 'Play' : 'Pause'} style={{ ...btnStyle, width: 32, height: 32 }}>
            {paused ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            )}
          </button>
          {onNext && (
            <button onClick={onNext} title="Next" style={btnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zM17 5v14h2V5h-2z"/></svg>
            </button>
          )}
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={toggleMute} style={btnStyle} title={muted ? 'Unmute' : 'Mute'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              {muted ? <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></> : <path d="M15.54 8.46a5 5 0 010 7.07"/>}
            </svg>
          </button>
          <input type="range" min={0} max={100} value={muted ? 0 : volume}
            onChange={e => changeVolume(Number(e.target.value))}
            style={{ width: '60px', accentColor: '#2F81F7' }} />
        </div>

        {/* Playlist */}
        {onTogglePlaylist && (
          <button onClick={onTogglePlaylist} title={`Playlist (${playlistCount || 0})`} style={{
            ...btnStyle, position: 'relative',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            {playlistCount ? <span style={{ position: 'absolute', top: '-2px', right: '-2px', fontSize: '9px', background: '#2F81F7', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{playlistCount}</span> : null}
          </button>
        )}

        {/* Stop */}
        <button onClick={onStop} title="Stop" style={btnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer',
  padding: '6px', display: 'flex', borderRadius: '4px',
}
