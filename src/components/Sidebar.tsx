import { useState, useEffect, useCallback } from 'react'
import { listFolder, DropboxEntry, isVideoFile } from '../lib/dropbox'

interface SidebarProps {
  accessToken: string
  view: 'browse' | 'recent'
  onViewChange: (view: 'browse' | 'recent') => void
  onNavigate: (path: string) => void
  onPlayVideo: (path: string, name: string) => void
  currentPath: string
  onLogout: () => void
}

const ROOT_KEY = '__root__'

export default function Sidebar({ accessToken, view, onViewChange, onNavigate, onPlayVideo, currentPath, onLogout }: SidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT_KEY]))
  const [children, setChildren] = useState<Record<string, DropboxEntry[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const loadChildren = useCallback(async (path: string) => {
    if (children[path]) return // Already loaded
    setLoading(prev => ({ ...prev, [path]: true }))
    try {
      const result = await listFolder(accessToken, path === ROOT_KEY ? '' : path)
      setChildren(prev => ({ ...prev, [path]: result.entries }))
    } catch {} finally {
      setLoading(prev => ({ ...prev, [path]: false }))
    }
  }, [accessToken, children])

  // Load root on mount
  useEffect(() => { loadChildren(ROOT_KEY) }, [])

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (!children[path]) loadChildren(path)
  }

  const renderTree = (parentPath: string, depth: number = 0): React.ReactNode[] => {
    const items = children[parentPath]
    if (!items) return []

    const folders = items.filter(e => e.tag === 'folder')
    const nodes: React.ReactNode[] = []

    for (const folder of folders) {
      const isExpanded = expanded.has(folder.path_lower)
      const isActive = currentPath === folder.path_lower
      const isLoading = loading[folder.path_lower]

      nodes.push(
        <div key={folder.path_lower}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12 + depth * 16, paddingRight: 8 }}>
            {/* Expand/collapse */}
            <button onClick={() => toggleExpand(folder.path_lower)}
              style={{ background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', padding: '4px 2px', display: 'flex', width: 16, justifyContent: 'center', flexShrink: 0 }}>
              {isLoading ? (
                <div style={{ width: 10, height: 10, border: '2px solid #6E7681', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>
            {/* Folder name */}
            <button onClick={() => { onNavigate(folder.path_lower); onViewChange('browse') }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
                background: isActive ? '#2F81F722' : 'transparent', border: 'none',
                color: isActive ? '#2F81F7' : '#8B949E', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px', textAlign: 'left', overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#21262D' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#E3B341" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
            </button>
          </div>
          {/* Children */}
          {isExpanded && renderTree(folder.path_lower, depth + 1)}
        </div>
      )
    }
    return nodes
  }

  // Render files in current path (if expanded in tree)
  const renderFiles = (parentPath: string): React.ReactNode[] => {
    const items = children[parentPath]
    if (!items) return []
    const files = items.filter(e => e.tag === 'file' && isVideoFile(e.name))
    if (files.length === 0) return []

    return files.slice(0, 5).map(file => (
      <button key={file.path_lower} onClick={() => onPlayVideo(file.path_lower, file.name)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '3px 12px 3px 40px',
          background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', fontSize: '11px', textAlign: 'left',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#21262D'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2" style={{ flexShrink: 0 }}>
          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
      </button>
    ))
  }

  return (
    <div style={{ width: '220px', background: '#161B22', borderRight: '1px solid #30363D', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* App name */}
      <div style={{ padding: '14px 14px 8px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#E6EDF3', margin: 0 }}>Excubia</h2>
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', padding: '0 8px 8px', gap: '2px' }}>
        <button onClick={() => onViewChange('browse')}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '12px', borderRadius: '4px',
            background: view === 'browse' ? '#21262D' : 'transparent',
            border: 'none', color: view === 'browse' ? '#E6EDF3' : '#6E7681', cursor: 'pointer', fontWeight: view === 'browse' ? 500 : 400,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          Browse
        </button>
        <button onClick={() => onViewChange('recent')}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '12px', borderRadius: '4px',
            background: view === 'recent' ? '#21262D' : 'transparent',
            border: 'none', color: view === 'recent' ? '#E6EDF3' : '#6E7681', cursor: 'pointer', fontWeight: view === 'recent' ? 500 : 400,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Recent
        </button>
      </div>

      {/* Folder tree */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderTree(ROOT_KEY)}
        {/* Show files in root */}
        {expanded.has(ROOT_KEY) && renderFiles(ROOT_KEY)}
      </div>

      {/* Logout */}
      <button onClick={onLogout}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px',
          background: 'transparent', border: 'none', borderTop: '1px solid #30363D',
          color: '#6E7681', cursor: 'pointer', fontSize: '12px', textAlign: 'left', width: '100%' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Disconnect
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
