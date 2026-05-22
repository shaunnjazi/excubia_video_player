import { useState } from 'react'

interface NowPlayingProps {
  videoName: string
  onNext?: () => void
  onPrev?: () => void
  onStop: () => void
  onTogglePlaylist?: () => void
  playlistCount?: number
}

export default function NowPlaying({ videoName, onNext, onPrev, onStop, onTogglePlaylist, playlistCount }: NowPlayingProps) {
  const [volume, setVolume] = useState(() => {
    try { return parseInt(localStorage.getItem('excubia_volume') || '100') } catch { return 100 }
  })
  const [muted, setMuted] = useState(false)

  const changeVolume = (v: number) => {
    setVolume(v)
    localStorage.setItem('excubia_volume', String(v))
  }
  const toggleMute = () => setMuted(m => !m)

  return (
    <div style={{ background: '#161B22', borderTop: '1px solid #30363D', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
      {/* Thumbnail area */}
      <div style={{ width: '40px', height: '24px', background: '#0D1117', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#2F81F7"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      </div>

      {/* Video info */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '13px', color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {videoName}
        </div>
        <div style={{ fontSize: '11px', color: '#6E7681' }}>
          Playing in mpv
        </div>
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {onPrev && (
          <button onClick={onPrev} title="Previous (B)" style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 19V5h2v14H5z"/></svg>
          </button>
        )}
        {onNext && (
          <button onClick={onNext} title="Next (N)" style={btnStyle}>
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

      {/* Playlist toggle */}
      {onTogglePlaylist && (
        <button onClick={onTogglePlaylist} title="Playlist" style={{ ...btnStyle, position: 'relative' }}>
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
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer',
  padding: '6px', display: 'flex', borderRadius: '4px',
}
