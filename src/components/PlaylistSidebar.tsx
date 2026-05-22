import { useState, useEffect, useCallback, useRef } from 'react'
import { getPlaylist, removeFromPlaylist, clearPlaylist, reorderPlaylist,
  getShuffle, setShuffle, getRepeat, setRepeat, type PlaylistItem, type RepeatMode } from '../services/playlist.service'

interface PlaylistSidebarProps {
  currentVideoPath: string | null
  onPlayVideo: (path: string, name: string) => void
  onClose: () => void
  initialWidth: number
}

export default function PlaylistSidebar({ currentVideoPath, onPlayVideo, onClose, initialWidth }: PlaylistSidebarProps) {
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [shuffle, setShuffleState] = useState(getShuffle)
  const [repeat, setRepeatState] = useState<RepeatMode>(getRepeat)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [width, setWidth] = useState(initialWidth)
  const [sortBy, setSortBy] = useState<'added' | 'name'>('added')
  const [showSort, setShowSort] = useState(false)
  const resizing = useRef(false)

  const refresh = useCallback(() => {
    setItems(getPlaylist())
    setShuffleState(getShuffle())
    setRepeatState(getRepeat())
  }, [])

  useEffect(() => { refresh() }, [])

  const smBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer',
    padding: '4px', borderRadius: '4px', display: 'flex',
  }

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true })
    return b.added - a.added
  })

  const toggleShuffle = () => {
    const next = !shuffle
    setShuffle(next); setShuffleState(next)
  }

  const cycleRepeat = () => {
    const next: Record<string, RepeatMode> = { off: 'all', all: 'one', one: 'off' }
    const mode = next[repeat] as RepeatMode
    setRepeat(mode); setRepeatState(mode)
  }

  const handleDragStart = (i: number) => setDragIdx(i)
  const handleDragOver = (i: number) => { setDragOverIdx(i); setDragIdx(dragIdx) }
  const handleDrop = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      reorderPlaylist(dragIdx, dragOverIdx)
      refresh()
    }
    setDragIdx(null); setDragOverIdx(null)
  }

  const handleRemove = (path: string) => {
    removeFromPlaylist(path)
    refresh()
  }

  return (
    <div style={{ width, background: '#161B22', borderLeft: '1px solid #30363D', display: 'flex', flexShrink: 0, position: 'relative' }}>
      {/* Resize handle */}
      <div
        onMouseDown={e => {
          resizing.current = true
          const startX = e.clientX
          const startW = width
          const onMouseMove = (ev: MouseEvent) => {
            const newW = Math.max(180, Math.min(600, startW + startX - ev.clientX))
            setWidth(newW)
          }
          const onMouseUp = () => {
            resizing.current = false
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
          }
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid #30363D' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#E6EDF3' }}>Playlist ({items.length})</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSort(s => !s)} title="Sort" style={smBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
                </svg>
              </button>
              {showSort && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#161B22', border: '1px solid #30363D', borderRadius: '6px', zIndex: 50, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '6px 10px', fontSize: '10px', color: '#6E7681', textTransform: 'uppercase', fontWeight: 600 }}>Sort by</div>
                  <button onClick={() => { setSortBy('added'); setShowSort(false) }} style={{ display: 'block', width: '100%', padding: '6px 10px', background: sortBy === 'added' ? '#2F81F722' : 'none', border: 'none', color: sortBy === 'added' ? '#2F81F7' : '#E6EDF3', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>Date Added</button>
                  <button onClick={() => { setSortBy('name'); setShowSort(false) }} style={{ display: 'block', width: '100%', padding: '6px 10px', background: sortBy === 'name' ? '#2F81F722' : 'none', border: 'none', color: sortBy === 'name' ? '#2F81F7' : '#E6EDF3', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>Name</button>
                </div>
              )}
            </div>
            <button onClick={onClose} style={smBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={toggleShuffle} title="Shuffle"
            style={{ padding: '4px 8px', background: shuffle ? '#2F81F722' : 'transparent',
              border: `1px solid ${shuffle ? '#2F81F7' : '#30363D'}`, borderRadius: '4px',
              color: shuffle ? '#2F81F7' : '#8B949E', cursor: 'pointer', fontSize: '11px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>
          <button onClick={cycleRepeat} title={`Repeat: ${repeat}`}
            style={{ padding: '4px 8px', background: repeat !== 'off' ? '#2F81F722' : 'transparent',
              border: `1px solid ${repeat !== 'off' ? '#2F81F7' : '#30363D'}`, borderRadius: '4px',
              color: repeat !== 'off' ? '#2F81F7' : '#8B949E', cursor: 'pointer', fontSize: '11px', position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            {repeat === 'one' && <span style={{ position: 'absolute', top: '-2px', right: '-2px', fontSize: '9px', background: '#2F81F7', color: '#fff', borderRadius: '50%', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => { clearPlaylist(); refresh() }} title="Clear all"
            style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #30363D',
              borderRadius: '4px', color: '#8B949E', cursor: 'pointer', fontSize: '11px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6E7681', fontSize: '12px' }}>
            Playlist empty
          </div>
        ) : sortedItems.map((item, i) => {
          const isCurrent = item.path === currentVideoPath
          return (
            <div key={item.path} draggable onDragStart={() => handleDragStart(i)}
              onDragOver={e => { e.preventDefault(); handleDragOver(i) }}
              onDrop={handleDrop} onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                background: isCurrent ? '#2F81F722' : dragOverIdx === i ? '#21262D' : 'none',
                border: isCurrent ? '1px solid #2F81F733' : 'none',
                cursor: 'pointer', fontSize: '12px', color: isCurrent ? '#2F81F7' : '#E6EDF3',
                borderLeft: isCurrent ? '3px solid #2F81F7' : '3px solid transparent',
              }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#6E7681" style={{ cursor: 'grab', flexShrink: 0 }}>
                <circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" />
                <circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" />
                <circle cx="9" cy="19" r="2" /><circle cx="15" cy="19" r="2" />
              </svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => onPlayVideo(item.path, item.name)}>
                {item.name}
              </span>
              <button onClick={() => handleRemove(item.path)} style={{ background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
