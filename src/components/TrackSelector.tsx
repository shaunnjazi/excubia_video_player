import { useState, useRef, useEffect } from 'react'

interface Track {
  id: number
  lang: string
  title: string
  default?: boolean
}

interface TrackSelectorProps {
  label: string
  tracks: Track[]
  activeId: number | null
  onSelect: (id: number | null) => void
  showOff?: boolean
}

export default function TrackSelector({ label, tracks, activeId, onSelect, showOff }: TrackSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: activeId !== null ? '#2F81F722' : 'none',
          border: activeId !== null ? '1px solid #2F81F7' : '1px solid transparent',
          color: activeId !== null ? '#2F81F7' : '#8B949E',
          cursor: 'pointer',
          padding: '4px 6px',
          display: 'flex',
          borderRadius: '4px',
          fontSize: '12px',
          gap: '4px',
          alignItems: 'center',
        }}
        title={label}
      >
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '8px',
            background: '#161B22',
            border: '1px solid #30363D',
            borderRadius: '8px',
            minWidth: '180px',
            maxHeight: '300px',
            overflow: 'auto',
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #30363D', fontSize: '14px', fontWeight: 600, color: '#E6EDF3' }}>
            {label}
          </div>
          {showOff && (
            <button
              onClick={() => { onSelect(null); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px',
                background: activeId === null ? '#2F81F722' : 'none', border: 'none', color: '#E6EDF3', cursor: 'pointer',
                textAlign: 'left', borderBottom: '1px solid #30363D', fontSize: '13px',
              }}
            >
              Off
            </button>
          )}
          {tracks.map(t => (
            <button
              key={t.id}
              onClick={() => { onSelect(t.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px',
                background: activeId === t.id ? '#2F81F722' : 'none', border: 'none',
                color: activeId === t.id ? '#2F81F7' : '#E6EDF3', cursor: 'pointer', textAlign: 'left', fontSize: '13px',
              }}
            >
              <span style={{ flex: 1 }}>{t.title || t.lang || `Track ${t.id}`}</span>
              {t.lang && <span style={{ fontSize: '11px', color: '#6E7681' }}>{t.lang}</span>}
              {t.default && <span style={{ fontSize: '10px', color: '#2F81F7' }}>●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
