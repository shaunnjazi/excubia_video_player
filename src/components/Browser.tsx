import { useState, useEffect, useCallback, useMemo } from 'react'
import { listFolder, getTemporaryLink, DropboxEntry, isVideoFile, isSubtitleFile, sortEntries, SortField, SortDir } from '../lib/dropbox'

interface BrowserProps {
  accessToken: string
  view: 'browse' | 'recent'
  onPlayVideo: (path: string, name: string) => void
  onNavigate: (path: string) => void
  currentPath: string
}

const RECENT_KEY = 'excubia_recent_videos'

function getRecentVideos(): { path: string; name: string; timestamp: number }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function addRecentVideo(path: string, name: string) {
  const recent = getRecentVideos().filter(v => v.path !== path)
  recent.unshift({ path, name, timestamp: Date.now() })
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)))
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return d.toLocaleDateString()
  } catch { return dateStr || '—' }
}

function fmtSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function Browser({ accessToken, view, onPlayVideo, onNavigate, currentPath }: BrowserProps) {
  const [entries, setEntries] = useState<DropboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingName, setPlayingName] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const loadFolder = useCallback(async (path: string) => {
    if (view !== 'browse') return
    setLoading(true)
    setError(null)
    onNavigate(path)
    setSearchQuery('')
    try {
      const result = await listFolder(accessToken, path)
      setEntries(result.entries.filter(e =>
        e.tag === 'folder' || isVideoFile(e.name) || isSubtitleFile(e.name)
      ))
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }, [accessToken, view, onNavigate])

  useEffect(() => {
    if (view === 'browse') loadFolder(currentPath)
  }, [view])

  const recentVideos = useMemo(() => {
    if (view !== 'recent') return []
    return getRecentVideos()
  }, [view])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handlePlay = async (entry: DropboxEntry) => {
    if (!isVideoFile(entry.name)) return
    setPlayError(null)
    setPlayingName(entry.name)
    try {
      const link = await getTemporaryLink(accessToken, entry.path_lower)
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('start_mpv', { url: link })
      addRecentVideo(entry.path_lower, entry.name)
      onPlayVideo(entry.path_lower, entry.name)
    } catch (err: any) {
      setPlayError(err.toString())
    } finally {
      setPlayingName(null)
    }
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let items = entries
    if (q) items = items.filter(e => e.name.toLowerCase().includes(q))
    return sortEntries(items, sortField, sortDir)
  }, [entries, searchQuery, sortField, sortDir])

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : []

  const SortHeader = ({ field, label, style }: { field: SortField; label: string; style?: React.CSSProperties }) => (
    <span onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '2px', ...style }}>
      {label}
      {sortField === field && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          {sortDir === 'asc'
            ? <polyline points="18 15 12 9 6 15" fill="none" stroke="currentColor" strokeWidth="2"/>
            : <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" strokeWidth="2"/>}
        </svg>
      )}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363D' }}>
        {/* Breadcrumb */}
        {view === 'browse' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '13px' }}>
            <button onClick={() => loadFolder('')}
              style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#21262D'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
            {pathParts.map((part, i) => {
              const fullPath = '/' + pathParts.slice(0, i + 1).join('/')
              const isLast = i === pathParts.length - 1
              return (
                <span key={fullPath} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6E7681" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {isLast ? (
                    <span style={{ color: '#E6EDF3', padding: '2px 4px' }}>{part}</span>
                  ) : (
                    <button onClick={() => loadFolder(fullPath)}
                      style={{ background: 'none', border: 'none', color: '#58A6FF', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', fontSize: '13px' }}>
                      {part}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {view === 'recent' && (
          <div style={{ marginBottom: '10px', fontSize: '15px', fontWeight: 600, color: '#E6EDF3' }}>Recent Videos</div>
        )}
        <input type="text" placeholder="Search files..."
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', background: '#21262D', border: '1px solid #30363D',
            borderRadius: '6px', color: '#E6EDF3', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Play error */}
      {playError && (
        <div style={{ padding: '8px 16px', background: '#3D1214', borderBottom: '1px solid #F85149', fontSize: '13px', color: '#F85149', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ flex: 1 }}>{playError}</span>
          <button onClick={() => setPlayError(null)} style={{ background: 'none', border: 'none', color: '#F85149', cursor: 'pointer', padding: '2px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Column headers (browse mode) */}
        {view === 'browse' && !loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #30363D', fontSize: '11px', color: '#6E7681', fontWeight: 600, textTransform: 'uppercase', gap: '8px' }}>
            <div style={{ width: '20px', flexShrink: 0 }} />
            <SortHeader field="name" label="Name" style={{ flex: 1 }} />
            <SortHeader field="modified" label="Modified" style={{ width: '100px', flexShrink: 0 }} />
            <SortHeader field="size" label="Size" style={{ width: '70px', flexShrink: 0, textAlign: 'right' }} />
          </div>
        )}

        {view === 'recent' && recentVideos.length > 0 && (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {recentVideos.map(v => (
              <button key={v.path} onClick={() => {
                const parent = v.path.substring(0, v.path.lastIndexOf('/'))
                onNavigate(parent || '')
              }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px',
                  background: 'none', border: 'none', color: '#E6EDF3', cursor: 'pointer', borderRadius: '6px',
                  fontSize: '13px', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#21262D'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8B949E', fontSize: '13px' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #2F81F7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Loading...
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#F85149', fontSize: '13px' }}>{error}</div>
        ) : view === 'browse' && filtered.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8B949E', fontSize: '13px' }}>
            {searchQuery.trim() ? 'No matching files' : currentPath ? 'This folder is empty' : 'No files found'}
          </div>
        ) : view === 'browse' ? (
          filtered.map(entry => {
            const isSub = isSubtitleFile(entry.name)
            const isVid = isVideoFile(entry.name)
            const isLoading = playingName === entry.name
            return (
              <button key={entry.path_lower} onClick={() => entry.tag === 'folder' ? loadFolder(entry.path_lower) : handlePlay(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px',
                  background: isLoading ? '#2F81F722' : 'none',
                  border: 'none', borderBottom: '1px solid #21262D',
                  color: isSub ? '#8B949E' : '#E6EDF3',
                  cursor: entry.tag === 'folder' || isVid ? 'pointer' : 'default',
                  fontSize: '13px', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#21262D' }}
                onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = 'none' }}>
                <div style={{ width: '20px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  {entry.tag === 'folder' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#E3B341"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                  ) : isSub ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 12h8" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  {isLoading && <div style={{ width: '12px', height: '12px', border: '2px solid #2F81F7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                </div>
                <div style={{ width: '100px', flexShrink: 0, fontSize: '11px', color: '#6E7681' }}>{fmtDate(entry.server_modified)}</div>
                <div style={{ width: '70px', flexShrink: 0, fontSize: '11px', color: '#6E7681', textAlign: 'right' }}>{entry.tag === 'file' ? fmtSize(entry.size) : '—'}</div>
              </button>
            )
          })
        ) : view === 'recent' && recentVideos.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8B949E', fontSize: '13px' }}>
            No recent videos. Play something to see it here.
          </div>
        ) : null}
      </div>

      {/* Status bar */}
      {view === 'browse' && !loading && !error && (
        <div style={{ padding: '6px 16px', borderTop: '1px solid #30363D', fontSize: '11px', color: '#6E7681' }}>
          {entries.filter(e => e.tag === 'folder').length} folders, {entries.filter(e => e.tag === 'file').length} files
          {searchQuery.trim() && ` — searching: "${searchQuery}"`}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
