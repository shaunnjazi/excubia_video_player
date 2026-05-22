import { useState } from 'react'

interface AuthGateProps {
  onToken: (token: string) => void
}

export default function AuthGate({ onToken }: AuthGateProps) {
  const [inputToken, setInputToken] = useState('')

  const handleSubmit = () => {
    const trimmed = inputToken.trim()
    if (trimmed) onToken(trimmed)
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0D1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      <img
        src="/9_k_Logo.png"
        alt="Excubia"
        style={{ width: '80px', height: '80px', borderRadius: '16px' }}
      />
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#E6EDF3' }}>
        Excubia Player
      </h1>
      <p style={{ color: '#8B949E', fontSize: '14px', margin: 0 }}>
        A native video player for Dropbox
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '360px',
        }}
      >
        <input
          type="text"
          placeholder="Paste your Dropbox access token..."
          value={inputToken}
          onChange={e => setInputToken(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          style={{
            padding: '12px 16px',
            background: '#21262D',
            border: '1px solid #30363D',
            borderRadius: '6px',
            color: '#E6EDF3',
            fontSize: '13px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!inputToken.trim()}
          style={{
            padding: '12px 24px',
            background: inputToken.trim() ? '#2F81F7' : '#21262D',
            color: inputToken.trim() ? '#fff' : '#6E7681',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: inputToken.trim() ? 'pointer' : 'default',
          }}
        >
          Connect Dropbox
        </button>
        <p style={{ color: '#6E7681', fontSize: '12px', textAlign: 'center', margin: 0 }}>
          Paste your Dropbox API access token to get started.
          <br />
          Get one from the{' '}
          <a
            href="https://www.dropbox.com/developers/apps"
            target="_blank"
            style={{ color: '#2F81F7' }}
          >
            Dropbox Developer Console
          </a>
        </p>
      </div>
    </div>
  )
}
