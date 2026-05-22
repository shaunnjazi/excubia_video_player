import { useState, useEffect, useCallback } from 'react'
import { listFolder, getTemporaryLink, DropboxEntry, isVideoFile, isSubtitleFile } from '../lib/dropbox'

interface BrowserProps {
  accessToken: string
  onPlayVideo: (path: string, name: string) => void
}

export default function Browser({ accessToken, onPlayVideo }: BrowserProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<DropboxEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingName, setPlayingName] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    setCurrentPath(path)
    setSearchQuery('')
    try {
      const result = await listFolder(accessToken, path)
      const folders = result.entries.filter(e => e.tag === 'folder')
      const files = result.entries.filter(e => e.tag === 'file' && (isVideoFile(e.name) || isSubtitleFile(e.name)))
      setEntries([...folders, ...files])
    } catch (err: any) {
      setError(err.toString())
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadFolder('')
  }, [])

  const handleDropboxLink = async (entry: DropboxEntry) => {
    if (!isVideoFile(entry.name)) return
    setPlayError(null)
    setPlayingName(entry.name)
    try {
      const link = await getTemporaryLink(accessToken, entry.path_lower)
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('launch_mpv', { url: link })
      onPlayVideo(entry.path_lower, entry.name)
    } catch (err: any) {
      setPlayError(err.toString())
      setPlayingName(null)
    }
  }

  const handleClick = (entry: DropboxEntry) => {
    if (entry.tag === 'folder') {
      loadFolder(entry.path_lower)
    } else {
      handleDropboxLink(entry)
    }
  }

  const filtered = searchQuery.trim()
    ? entries.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries

  // Build breadcrumb path items
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : []

  const isEmptyFolder = !loading && !error && filtered.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363D' }}>
        {/* Breadcrumb navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '13px', color: '#8B949E' }}>
          <button onClick={() => loadFolder('')} style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', fontSize: '13px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#21262D'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          {currentPath && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#6E7681"><polyline points="9 18 15 12 9 6" fill="none" stroke="#6E7681" strokeWidth="2"/></svg>
          )}
          {pathParts.map((part, i) => {
            const fullPath = '/' + pathParts.slice(0, i + 1).join('/')
            const isLast = i === pathParts.length - 1
            return (
              <span key={fullPath} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {!isLast ? (
                  <button onClick={() => loadFolder(fullPath)} style={{ background: 'none', border: 'none', color: '#58A6FF', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', fontSize: '13px' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#21262D'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {part}
                  </button>
                ) : (
                  <span style={{ color: '#E6EDF3', padding: '2px 4px' }}>{part}</span>
                )}
                {!isLast && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6E7681" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </span>
            )
          })}
        </div>
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', background: '#21262D', border: '1px solid #30363D',
            borderRadius: '6px', color: '#E6EDF3', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Play error banner */}
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
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8B949E', fontSize: '13px' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #2F81F7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Loading files...
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#F85149', fontSize: '13px' }}>
            {error}
          </div>
        ) : isEmptyFolder ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8B949E', fontSize: '13px' }}>
            {searchQuery.trim() ? 'No matching files' : currentPath ? 'This folder is empty' : 'No files found'}
          </div>
        ) : (
          filtered.map(entry => {
            const isSub = !isVideoFile(entry.name) && isSubtitleFile(entry.name)
            const isVideo = isVideoFile(entry.name)
            const isLoading = playingName === entry.name
            return (
              <button
                key={entry.path_lower}
                onClick={() => handleClick(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '8px 12px', background: isLoading ? '#2F81F722' : 'none',
                  border: isLoading ? '1px solid #2F81F7' : 'none',
                  color: isSub ? '#8B949E' : '#E6EDF3',
                  cursor: entry.tag === 'folder' || isVideo ? 'pointer' : 'default',
                  borderRadius: '6px', fontSize: '13px', textAlign: 'left',
                  opacity: isSub && searchQuery.trim() ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#21262D' }}
                onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = 'none' }}
              >
                {entry.tag === 'folder' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#E3B341" stroke="#E3B341" strokeWidth="1.5">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                ) : isSub ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 12h8" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {entry.name}
                    {isLoading && (
                      <div style={{ width: '12px', height: '12px', border: '2px solid #2F81F7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    )}
                    {isSub && <span style={{ fontSize: '10px', color: '#6E7681', background: '#21262D', padding: '1px 4px', borderRadius: '3px' }}>sub</span>}
                  </div>
                  {entry.size && isVideo && (
                    <div style={{ fontSize: '11px', color: '#6E7681' }}>{formatSize(entry.size)}</div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
